package com.petoxmju.petox.pet

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.uimanager.ViewManager
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.segmentation.subject.SubjectSegmentation
import com.google.mlkit.vision.segmentation.subject.SubjectSegmenterOptions
import java.util.concurrent.TimeUnit
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream
import kotlin.concurrent.thread
import kotlin.math.cbrt
import kotlin.math.pow
import kotlin.math.sqrt

/**
 * 반려동물 사진 → 견종 픽셀 템플릿 재색칠 (AI 저장소 pet_template/reference.py 이식).
 * JS 이름: NativeModules.PetoxPetRecolor
 *
 * 1. 배경 제거: ML Kit Subject Segmentation 으로 반려동물(주 피사체) 픽셀만 남긴다 (reference.py 의 rembg 자리).
 *    모델이 아직 없거나 실패하면 사진 가운데 부분만 본다.
 * 2. 털색 뽑기: 남은 픽셀을 Lab 에서 가장 가까운 스와치(breeds.json)에 붙여 면적 순 main·sub.
 * 3. 견종 × main·sub → 색 치환표: reference.py 의 fit_to_template + color_map 결과를 미리 뽑아 둔
 *    assets/pet_templates/recolor.json 을 그대로 쓴다 (앱과 파이썬이 같은 결과).
 * 4. assets/pet_templates/<견종>.png(홈 스프라이트) 픽셀을 치환해 앱 files/pets/ 에 PNG 로 저장.
 * 사진은 기기 밖으로 나가지 않고, 읽은 뒤 바로 버린다.
 */
class PetRecolorModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
    override fun getName() = "PetoxPetRecolor"

    private companion object {
        const val SUB_RATIO = 0.2
        const val MAX_SIDE = 512
        /** 이 확률 이상이면 반려동물 픽셀로 본다 */
        const val FOREGROUND = 0.5f
        /** 배경 제거에 쓰는 최대 시간 — 넘으면 가운데만 본다 */
        const val SEGMENT_TIMEOUT_SEC = 8L
    }

    private val table: JSONObject by lazy {
        JSONObject(context.assets.open("pet_templates/recolor.json").bufferedReader().use { it.readText() })
    }

    @ReactMethod
    fun make(photoUri: String, breed: String, promise: Promise) {
        thread(name = "petox-recolor") {
            try {
                val maps = table.getJSONObject("maps")
                if (!maps.has(breed)) {
                    promise.reject("NO_BREED", "unknown breed $breed")
                    return@thread
                }
                val swatches = table.getJSONObject("swatches")
                val names = swatches.keys().asSequence().toList()
                val swatchLabs = names.map { hexToLab(swatches.getString(it)) }

                // 1) 사진 → main·sub 스와치
                val photo = decodePhoto(photoUri)
                var main: String? = null
                var sub: String? = null
                var segmented = false
                if (photo != null) {
                    val counts = IntArray(names.size)
                    var total = 0
                    // 배경 제거 마스크 (w*h, 0~1). 없으면 가운데 영역만 본다
                    val mask = foregroundMask(photo)
                    segmented = mask != null
                    val x0 = if (mask != null) 0 else photo.width / 4
                    val x1 = if (mask != null) photo.width else photo.width * 3 / 4
                    val y0 = if (mask != null) 0 else photo.height / 5
                    val y1 = if (mask != null) photo.height else photo.height * 4 / 5
                    val stride = maxOf(1, maxOf(photo.width, photo.height) / 256)
                    var y = y0
                    while (y < y1) {
                        var x = x0
                        while (x < x1) {
                            val p = photo.getPixel(x, y)
                            val isPet = mask == null || mask[y * photo.width + x] >= FOREGROUND
                            if (isPet && (p ushr 24) > 128) {
                                val lab = rgbToLab((p shr 16) and 0xFF, (p shr 8) and 0xFF, p and 0xFF)
                                var best = 0
                                var bestD = Double.MAX_VALUE
                                for (i in swatchLabs.indices) {
                                    val d = dist(lab, swatchLabs[i])
                                    if (d < bestD) { bestD = d; best = i }
                                }
                                counts[best]++
                                total++
                            }
                            x += stride
                        }
                        y += stride
                    }
                    photo.recycle()
                    if (total > 0) {
                        val order = counts.indices.sortedByDescending { counts[it] }
                        main = names[order[0]]
                        if (order.size > 1 && counts[order[1]].toDouble() / total >= SUB_RATIO) sub = names[order[1]]
                    }
                }

                // 2) 치환표 (사진을 못 읽었으면 빈 표 = 템플릿 원본색)
                val breedMaps = maps.getJSONObject(breed)
                val key = "${main ?: ""}|${sub ?: ""}"
                val cmap = HashMap<Int, Int>()
                if (main != null && breedMaps.has(key)) {
                    val m = breedMaps.getJSONObject(key)
                    for (src in m.keys()) cmap[hexToRgb(src)] = hexToRgb(m.getString(src))
                }

                // 3) 템플릿 치환 → PNG
                val template = context.assets.open("pet_templates/$breed.png").use { BitmapFactory.decodeStream(it) }
                val out = template.copy(Bitmap.Config.ARGB_8888, true)
                template.recycle()
                val px = IntArray(out.width * out.height)
                out.getPixels(px, 0, out.width, 0, 0, out.width, out.height)
                for (i in px.indices) {
                    val p = px[i]
                    if ((p ushr 24) == 0) continue
                    val dst = cmap[p and 0xFFFFFF] ?: continue
                    px[i] = (p and 0xFF000000.toInt()) or dst
                }
                out.setPixels(px, 0, out.width, 0, 0, out.width, out.height)
                val dir = File(context.filesDir, "pets").apply { mkdirs() }
                val file = File(dir, "pet-${System.currentTimeMillis()}.png")
                FileOutputStream(file).use { out.compress(Bitmap.CompressFormat.PNG, 100, it) }
                out.recycle()

                val result = Arguments.createMap()
                result.putString("uri", Uri.fromFile(file).toString())
                result.putString("main", main)
                result.putString("sub", sub)
                result.putBoolean("segmented", segmented)
                promise.resolve(result)
            } catch (e: Throwable) {
                promise.reject("RECOLOR_FAILED", e.message, e)
            }
        }
    }

    /**
     * ML Kit 으로 주 피사체(반려동물) 확률 마스크를 얻는다. 모델이 아직 내려받는 중이거나
     * 실패·시간 초과면 null — 호출 측은 사진 가운데만 본다. 피사체가 너무 작아도 null.
     */
    private fun foregroundMask(photo: Bitmap): FloatArray? {
        val segmenter = SubjectSegmentation.getClient(
            SubjectSegmenterOptions.Builder().enableForegroundConfidenceMask().build(),
        )
        return try {
            val result = Tasks.await(
                segmenter.process(InputImage.fromBitmap(photo, 0)),
                SEGMENT_TIMEOUT_SEC,
                TimeUnit.SECONDS,
            )
            val buf = result.foregroundConfidenceMask ?: return null
            val mask = FloatArray(photo.width * photo.height)
            buf.rewind()
            buf.get(mask)
            val fg = mask.count { it >= FOREGROUND }
            if (fg < mask.size / 100) null else mask // 1% 도 안 되면 못 찾은 것
        } catch (e: Exception) {
            android.util.Log.w("PetoxRecolor", "subject segmentation failed — 가운데만 봅니다", e)
            null
        } finally {
            segmenter.close()
        }
    }

    private fun decodePhoto(uri: String): Bitmap? {
        fun open(): InputStream? =
            if (uri.startsWith("/")) File(uri).inputStream()
            else context.contentResolver.openInputStream(Uri.parse(uri))
        return try {
            val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            open()?.use { BitmapFactory.decodeStream(it, null, bounds) }
            var sample = 1
            while (maxOf(bounds.outWidth, bounds.outHeight) / (sample * 2) >= MAX_SIDE) sample *= 2
            val opts = BitmapFactory.Options().apply { inSampleSize = sample }
            open()?.use { BitmapFactory.decodeStream(it, null, opts) }
        } catch (e: Exception) {
            null
        }
    }

    // ── 색 공간 (reference.py 와 같은 sRGB(D65) → Lab) ──
    private fun hexToRgb(h: String): Int = h.substring(1).toInt(16)

    private fun hexToLab(h: String): DoubleArray {
        val v = hexToRgb(h)
        return rgbToLab((v shr 16) and 0xFF, (v shr 8) and 0xFF, v and 0xFF)
    }

    private fun lin(c: Int): Double {
        val s = c / 255.0
        return if (s <= 0.04045) s / 12.92 else ((s + 0.055) / 1.055).pow(2.4)
    }

    private fun f(t: Double): Double {
        val e = 6.0 / 29
        return if (t > e * e * e) cbrt(t) else t / (3 * e * e) + 4.0 / 29
    }

    private fun rgbToLab(r8: Int, g8: Int, b8: Int): DoubleArray {
        val r = lin(r8)
        val g = lin(g8)
        val b = lin(b8)
        val x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047
        val y = (0.2126729 * r + 0.7151522 * g + 0.0721750 * b) / 1.0
        val z = (0.0193339 * r + 0.1191920 * g + 0.9503041 * b) / 1.08883
        val fx = f(x)
        val fy = f(y)
        val fz = f(z)
        return doubleArrayOf(116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz))
    }

    private fun dist(a: DoubleArray, b: DoubleArray): Double {
        val d0 = a[0] - b[0]
        val d1 = a[1] - b[1]
        val d2 = a[2] - b[2]
        return sqrt(d0 * d0 + d1 * d1 + d2 * d2)
    }
}

class PetRecolorPackage : ReactPackage {
    override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> =
        listOf(PetRecolorModule(context))

    override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
