package com.petoxmju.petox.apps

import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.drawable.Drawable
import android.util.Base64
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.uimanager.ViewManager
import java.io.ByteArrayOutputStream
import kotlin.concurrent.thread

/**
 * 폰에 설치된 앱 목록 (감지 앱 선택용). JS 이름: NativeModules.PetoxApps
 *
 * 홈 화면에 아이콘이 있는 앱(런처 앱)만 돌려준다. 이것만 보면 되므로 QUERY_ALL_PACKAGES 대신
 * 매니페스트 <queries> 에 MAIN/LAUNCHER 인텐트를 선언해 두었다 (Android 11+ 패키지 가시성).
 */
class InstalledAppsModule(private val context: ReactApplicationContext) :
    ReactContextBaseJavaModule(context) {
    override fun getName() = "PetoxApps"

    /** [{ packageName, label, icon: "data:image/png;base64,…" }] — 이름순, 펫톡스 자신 제외 */
    @ReactMethod
    fun getLaunchableApps(promise: Promise) {
        thread(name = "petox-installed-apps") {
            try {
                val pm = context.packageManager
                val intent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
                val seen = HashSet<String>()
                val apps = pm.queryIntentActivities(intent, 0)
                    .filter { it.activityInfo.packageName != context.packageName }
                    .filter { seen.add(it.activityInfo.packageName) } // 앱 하나에 런처 여러 개면 한 번만
                    .map { info ->
                        Triple(
                            info.activityInfo.packageName,
                            info.loadLabel(pm).toString(),
                            info,
                        )
                    }
                    .sortedBy { it.second }

                val result = Arguments.createArray()
                for ((pkg, label, info) in apps) {
                    val map = Arguments.createMap()
                    map.putString("packageName", pkg)
                    map.putString("label", label)
                    map.putString("icon", iconDataUri(info.loadIcon(pm)))
                    result.pushMap(map)
                }
                promise.resolve(result)
            } catch (e: Exception) {
                promise.reject("E_APPS", e)
            }
        }
    }

    private fun iconDataUri(drawable: Drawable?): String? {
        if (drawable == null) return null
        return try {
            val bitmap = Bitmap.createBitmap(ICON_PX, ICON_PX, Bitmap.Config.ARGB_8888)
            val canvas = Canvas(bitmap)
            drawable.setBounds(0, 0, ICON_PX, ICON_PX)
            drawable.draw(canvas)
            val out = ByteArrayOutputStream()
            bitmap.compress(Bitmap.CompressFormat.PNG, 100, out)
            "data:image/png;base64," + Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
        } catch (e: Exception) {
            null
        }
    }

    companion object {
        private const val ICON_PX = 96
    }
}

class InstalledAppsPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
        listOf(InstalledAppsModule(reactContext))

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
        emptyList()
}
