package com.petoxmju.petox.overlay

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.uimanager.ViewManager

/** JS ↔ 오버레이 서비스. JS 이름: NativeModules.PetoxOverlay */
class OverlayModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
    override fun getName() = "PetoxOverlay"

    @ReactMethod
    fun canDrawOverlays(promise: Promise) {
        promise.resolve(Settings.canDrawOverlays(context))
    }

    /** 설정 > 다른 앱 위에 표시 — 펫톡스 항목으로 바로 연다 */
    @ReactMethod
    fun openOverlaySettings() {
        val intent = Intent(
            Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
            Uri.parse("package:" + context.packageName),
        ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
    }

    @ReactMethod
    fun start(config: ReadableMap, promise: Promise) {
        try {
            val intent = Intent(context, OverlayService::class.java).apply {
                putExtra(OverlayService.EXTRA_PET_URI, if (config.hasKey("petUri")) config.getString("petUri") else null)
                putExtra(
                    OverlayService.EXTRA_APPEAR_AFTER,
                    if (config.hasKey("appearAfterSec")) config.getInt("appearAfterSec") else 60,
                )
                putExtra(
                    OverlayService.EXTRA_GROW_EVERY,
                    if (config.hasKey("growEverySec")) config.getInt("growEverySec") else 30,
                )
                if (config.hasKey("targets")) {
                    val arr = config.getArray("targets")
                    if (arr != null) {
                        putExtra(
                            OverlayService.EXTRA_TARGETS,
                            Array(arr.size()) { i -> arr.getString(i) ?: "" },
                        )
                    }
                }
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("OVERLAY_START_FAILED", e.message, e)
        }
    }

    @ReactMethod
    fun stop() {
        context.stopService(Intent(context, OverlayService::class.java))
    }

    @ReactMethod
    fun isRunning(promise: Promise) {
        promise.resolve(OverlayService.isRunning)
    }
}

class OverlayPackage : ReactPackage {
    override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> =
        listOf(OverlayModule(context))

    override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
