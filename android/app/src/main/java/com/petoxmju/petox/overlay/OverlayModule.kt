package com.petoxmju.petox.overlay

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.media.projection.MediaProjectionConfig
import android.media.projection.MediaProjectionManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.BaseActivityEventListener
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

    private companion object {
        const val REQ_SCREEN_CAPTURE = 7202
    }

    // 화면 캡처 허용 결과 — 다음 start() 때 서비스로 넘기고 비운다 (한 번만 쓸 수 있다)
    private var captureCode = 0
    private var captureData: Intent? = null
    private var capturePromise: Promise? = null

    private val activityListener = object : BaseActivityEventListener() {
        override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
            if (requestCode != REQ_SCREEN_CAPTURE) return
            val promise = capturePromise ?: return
            capturePromise = null
            if (resultCode == Activity.RESULT_OK && data != null) {
                captureCode = resultCode
                captureData = data
                promise.resolve(true)
            } else {
                promise.resolve(false)
            }
        }
    }

    init {
        context.addActivityEventListener(activityListener)
    }

    /**
     * 숏폼 화면 판별용 화면 캡처 허용 창을 띄운다. 허용하면 true — 다음 start() 에서 서비스가 캡처를 시작한다.
     * Android 14+ 는 "화면 전체"만 고를 수 있게 한다 (앱 하나만 공유하면 숏폼 앱 화면이 안 보인다).
     */
    @ReactMethod
    fun requestScreenCapture(promise: Promise) {
        val activity = context.currentActivity
        if (activity == null || capturePromise != null) {
            promise.resolve(false)
            return
        }
        try {
            val mpm = context.getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
            val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                mpm.createScreenCaptureIntent(MediaProjectionConfig.createConfigForDefaultDisplay())
            } else {
                mpm.createScreenCaptureIntent()
            }
            capturePromise = promise
            activity.startActivityForResult(intent, REQ_SCREEN_CAPTURE)
        } catch (e: Exception) {
            capturePromise = null
            promise.reject("SCREEN_CAPTURE_FAILED", e.message, e)
        }
    }

    /** 서비스가 지금 화면 캡처로 숏폼을 판별하고 있는가 */
    @ReactMethod
    fun isCapturing(promise: Promise) {
        promise.resolve(OverlayService.isCapturing)
    }

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
                // 등장할 때 걸어 들어오는 프레임들 (왼쪽을 보고 걷는 그림). 없으면 걷기 없이 나타난다
                if (config.hasKey("walkFrames")) {
                    val frames = config.getArray("walkFrames")
                    if (frames != null) {
                        putExtra(
                            OverlayService.EXTRA_WALK_FRAMES,
                            Array(frames.size()) { i -> frames.getString(i) ?: "" },
                        )
                    }
                }
                if (config.hasKey("walkWidthRatio")) {
                    putExtra(OverlayService.EXTRA_WALK_RATIO, config.getDouble("walkWidthRatio").toFloat())
                }
                // 방금 받은 화면 캡처 허용 결과 (한 번만 넘긴다)
                captureData?.let { data ->
                    putExtra(OverlayService.EXTRA_CAPTURE_CODE, captureCode)
                    putExtra(OverlayService.EXTRA_CAPTURE_DATA, data)
                    captureCode = 0
                    captureData = null
                }
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
