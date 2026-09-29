package com.petoxmju.petox.pet

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.media.ExifInterface
import android.net.Uri
import android.util.Log
import androidx.core.content.pm.PackageInfoCompat
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.uimanager.ViewManager
import com.google.android.gms.common.moduleinstall.ModuleInstall
import com.google.android.gms.common.moduleinstall.ModuleInstallRequest
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.segmentation.subject.SubjectSegmentation
import com.google.mlkit.vision.segmentation.subject.SubjectSegmenterOptions
import java.io.File
import java.io.InputStream
import java.net.URL
import java.security.MessageDigest
import java.util.concurrent.TimeUnit
import kotlin.concurrent.thread
import kotlin.math.max

private const val TAG = "PetTemplate"
private const val MAX_PHOTO_SIDE = 1024 // ML Kit 입력. 털색은 256 칸 간격으로 뽑으므로 이보다 크게 읽을 필요가 없다
private const val MODULE_WAIT_SEC = 30L

/**
 * 반려견 사진 → 털색(스와치 이름), 견종 + 털색 → 재색칠한 스프라이트 파일.
 * 사진은 기기 밖으로 나가지 않는다. 계산은 [PetPalette] (AI 저장소 reference.py 이식).
 */
class PetTemplateModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
    override fun getName() = "PetoxPetTemplate"

    private val palette by lazy { PetPalette.parse(paletteJson) }
    private val paletteJson by lazy { context.assets.open("pet_palette.json").bufferedReader().use { it.readText() } }

    /**
     * 사진 → { main, sub } 스와치 이름. 사진을 못 읽거나 배경 제거·추출이 실패하면 둘 다 null 이고
     * reason 에 이유를 담는다 — 호출 측은 원본색으로 진행한다. 가입 흐름을 막지 않도록 reject 하지 않는다.
     */
    @ReactMethod
    fun extractFurColors(photoUri: String, promise: Promise) {
        thread(name = "petox-fur") {
            val out = Arguments.createMap()
            try {
                val photo = decodeUpright(Uri.parse(photoUri)) ?: error("사진을 읽지 못함")
                val fg = segment(photo)
                val px = IntArray(fg.width * fg.height).also { fg.getPixels(it, 0, fg.width, 0, 0, fg.width, fg.height) }
                val (main, sub) = palette.extractColors(px, fg.width, fg.height)
                out.putString("main", main)
                out.putString("sub", sub)
                if (main == null) out.putString("reason", "배경 제거 후 남은 픽셀이 없음")
            } catch (e: Exception) {
                Log.w(TAG, "털색 추출 실패 — 원본색으로 진행", e)
                out.putNull("main")
                out.putNull("sub")
                out.putString("reason", e.message ?: e.javaClass.simpleName)
            }
            promise.resolve(out)
        }
    }

    /**
     * 견종 + 털색 → sources 의 각 이미지를 재색칠한 PNG 파일 경로(file://). 키는 그대로 돌려준다.
     * main·sub 가 둘 다 null(사진 없음·추출 실패)이면 sources 를 그대로 돌려준다.
     * 사용자가 스와치를 직접 고른 경우 fit=false 로 불러 밝기 순서 맞추기를 건너뛴다.
     * 결과는 filesDir/pet/ 에 입력별로 저장해 두고 같은 입력이면 다시 만들지 않는다.
     */
    @ReactMethod
    fun renderPet(breed: String, main: String?, sub: String?, fit: Boolean, sources: ReadableMap, promise: Promise) {
        thread(name = "petox-render") {
            try {
                val src = sources.toHashMap().mapValues { it.value as String }
                val mainHex = main?.let { palette.swatches[it] ?: error("모르는 스와치: $it") }
                val subHex = sub?.let { palette.swatches[it] ?: error("모르는 스와치: $it") }
                val (m, s) = if (fit) palette.fitToTemplate(breed, mainHex, subHex) else mainHex to subHex
                val map = palette.colorMap(breed, m, s)
                val result = Arguments.createMap()
                if (map.isEmpty()) {
                    src.forEach { (k, v) -> result.putString(k, v) }
                    return@thread promise.resolve(result)
                }
                val dir = File(context.filesDir, "pet/" + cacheKey(breed, m, s, src)).apply { mkdirs() }
                for ((key, uri) in src.toSortedMap()) {
                    val file = File(dir, key.replace(Regex("[^A-Za-z0-9_-]"), "_") + ".png")
                    if (!file.exists()) {
                        val bmp = loadSprite(uri) ?: error("스프라이트를 읽지 못함: $key")
                        val px = IntArray(bmp.width * bmp.height).also { bmp.getPixels(it, 0, bmp.width, 0, 0, bmp.width, bmp.height) }
                        PetPalette.recolor(px, map)
                        // 호출마다 고유한 임시 파일에 쓰고 rename — 같은 키로 동시에 불려도 서로 덮어쓰지 않고, 쓰다 끊긴 파일을 캐시로 쓰지 않게
                        val tmp = File.createTempFile("s_" + file.nameWithoutExtension, ".tmp", dir)
                        try {
                            val ok = tmp.outputStream().use { Bitmap.createBitmap(px, bmp.width, bmp.height, Bitmap.Config.ARGB_8888).compress(Bitmap.CompressFormat.PNG, 100, it) }
                            // 다른 호출이 먼저 만들었으면 그 파일을 쓴다. 못 옮겼는데 대상도 없으면 실패
                            if (ok && !file.exists() && !tmp.renameTo(file) && !file.exists()) error("스프라이트 저장 실패: $key")
                            if (!ok && !file.exists()) error("스프라이트 저장 실패: $key")
                        } finally {
                            tmp.delete() // rename 성공 후엔 이미 없어 no-op
                        }
                    }
                    result.putString(key, Uri.fromFile(file).toString())
                }
                promise.resolve(result)
            } catch (e: Exception) {
                promise.reject("PET_RENDER_FAILED", e.message, e)
            }
        }
    }

    /** 스프라이트·팔레트·앱 버전이 바뀌면 키가 바뀌어 새로 만든다. 릴리스의 스프라이트 소스는 drawable 이름이라 그림이 바뀌어도 그대로고, filesDir 는 업데이트 후에도 남는다. */
    private fun cacheKey(breed: String, main: String?, sub: String?, src: Map<String, String>): String {
        val pkg = context.packageManager.getPackageInfo(context.packageName, 0)
        val version = "${PackageInfoCompat.getLongVersionCode(pkg)}:${pkg.lastUpdateTime}"
        val text = listOf(breed, main, sub, paletteJson, src.toSortedMap().toString(), version).joinToString("\n")
        return MessageDigest.getInstance("SHA-1").digest(text.toByteArray()).joinToString("") { "%02x".format(it) }.take(16)
    }

    /**
     * Image.resolveAssetSource(require(...)).uri: 디버그는 Metro(http), 릴리스는 drawable 리소스 이름.
     * 리소스는 inScaled=false 로 읽는다 — 밀도 폴더 배율이 적용되면 픽셀이 번져 색 치환이 안 맞는다.
     */
    private fun loadSprite(uri: String): Bitmap? {
        val opts = BitmapFactory.Options().apply { inScaled = false; inPremultiplied = false }
        return when {
            uri.startsWith("http://") || uri.startsWith("https://") -> URL(uri).openStream().use { BitmapFactory.decodeStream(it, null, opts) }
            uri.startsWith("file://") || uri.startsWith("content://") -> open(Uri.parse(uri))?.use { BitmapFactory.decodeStream(it, null, opts) }
            else -> {
                val id = context.resources.getIdentifier(uri, "drawable", context.packageName)
                if (id == 0) null else BitmapFactory.decodeResource(context.resources, id, opts)
            }
        }
    }

    private fun open(uri: Uri): InputStream? =
        if (uri.scheme == "file") File(uri.path!!).inputStream() else context.contentResolver.openInputStream(uri)

    /** EXIF 회전을 적용하고 긴 변을 MAX_PHOTO_SIDE 이하로 줄여 읽는다. */
    private fun decodeUpright(uri: Uri): Bitmap? {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        // 크기만 읽는 디코딩은 성공해도 null 을 돌려준다 — 스트림을 못 열었거나 크기를 못 읽은 경우만 실패
        open(uri)?.use { BitmapFactory.decodeStream(it, null, bounds); true } ?: return null
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null
        var sample = 1
        while (max(bounds.outWidth, bounds.outHeight) / (sample * 2) >= MAX_PHOTO_SIDE) sample *= 2
        val bmp = open(uri)?.use { BitmapFactory.decodeStream(it, null, BitmapFactory.Options().apply { inSampleSize = sample }) } ?: return null
        val degrees = open(uri)?.use {
            when (ExifInterface(it).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)) {
                ExifInterface.ORIENTATION_ROTATE_90 -> 90f
                ExifInterface.ORIENTATION_ROTATE_180 -> 180f
                ExifInterface.ORIENTATION_ROTATE_270 -> 270f
                else -> 0f
            }
        } ?: 0f
        if (degrees == 0f) return bmp
        return Bitmap.createBitmap(bmp, 0, 0, bmp.width, bmp.height, Matrix().apply { postRotate(degrees) }, true)
    }

    /** ML Kit Subject Segmentation 으로 배경을 지운 RGBA. 처음 쓸 때 Play 서비스가 모델 모듈을 내려받는다. */
    private fun segment(photo: Bitmap): Bitmap {
        val segmenter = SubjectSegmentation.getClient(SubjectSegmenterOptions.Builder().enableForegroundBitmap().build())
        try {
            Tasks.await(
                ModuleInstall.getClient(context).installModules(ModuleInstallRequest.newBuilder().addApi(segmenter).build()),
                MODULE_WAIT_SEC, TimeUnit.SECONDS,
            )
            // 설치 요청이 끝나도 모듈 다운로드가 늦게 끝날 수 있다 — "Waiting for ... module" 이면 잠깐 기다렸다 다시 한다
            repeat(MODULE_WAIT_SEC.toInt()) { attempt ->
                try {
                    val result = Tasks.await(segmenter.process(InputImage.fromBitmap(photo, 0)), MODULE_WAIT_SEC, TimeUnit.SECONDS)
                    return result.foregroundBitmap ?: error("전경 없음")
                } catch (e: java.util.concurrent.ExecutionException) {
                    if (e.cause?.message?.contains("Waiting for") != true || attempt == MODULE_WAIT_SEC.toInt() - 1) throw e
                    Thread.sleep(1000)
                }
            }
            error("배경 제거 모듈 준비 시간 초과")
        } finally {
            segmenter.close()
        }
    }

}

class PetTemplatePackage : ReactPackage {
    override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> = listOf(PetTemplateModule(context))

    override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
