package com.petoxmju.petox.overlay

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.PixelFormat
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import android.provider.Settings
import android.util.Log
import android.view.Gravity
import android.view.WindowManager
import android.widget.ImageView
import com.petoxmju.petox.MainActivity
import com.petoxmju.petox.R
import java.net.URL
import kotlin.concurrent.thread

/**
 * 숏폼 앱을 보고 있으면 내 펫을 다른 앱 위에 띄우는 포그라운드 서비스.
 *
 * 1초마다 UsageStatsManager 로 "지금 앞에 떠 있는 앱"을 확인한다.
 * - 대상 앱(유튜브·인스타·틱톡)을 appearAfterSec 초 이상 연속으로 보면 펫이 화면 오른쪽 아래에 나타난다.
 * - 계속 보면 growEverySec 초마다 펫이 한 단계씩 커지고(최대 4단계) 진동한다.
 * - 대상 앱을 벗어나면 펫이 사라지고 시간도 처음부터 다시 센다.
 * - 펫을 누르면 펫톡스 앱이 열린다.
 *
 * 화면 내용은 보지 않는다(앱 단위 감지). 숏폼 화면만 골라내는 분류기는 AI 쪽 모델이 나오면 붙인다.
 */
class OverlayService : Service() {

    companion object {
        private const val TAG = "PetoxOverlay"
        private const val CHANNEL_ID = "petox_overlay"
        private const val NOTIFICATION_ID = 7201
        private const val PREFS = "petox_overlay"
        private const val TICK_MS = 1000L
        private const val BASE_SIZE_DP = 96
        /** 단계별 배율 — 처음엔 작게, 오래 볼수록 화면을 더 가린다 */
        private val STAGE_SCALES = floatArrayOf(1.0f, 1.6f, 2.3f, 3.2f)

        const val EXTRA_PET_URI = "petUri"
        const val EXTRA_APPEAR_AFTER = "appearAfterSec"
        const val EXTRA_GROW_EVERY = "growEverySec"
        const val EXTRA_TARGETS = "targets"

        @Volatile
        var isRunning = false
            private set

        val DEFAULT_TARGETS = arrayOf(
            "com.google.android.youtube",
            "com.instagram.android",
            "com.zhiliaoapp.musically",
            "com.ss.android.ugc.trill",
        )
    }

    private val handler = Handler(Looper.getMainLooper())
    private lateinit var windowManager: WindowManager
    private var petView: ImageView? = null
    private var petBitmap: Bitmap? = null

    private var petUri: String? = null
    private var appearAfterSec = 60
    private var growEverySec = 30
    private var targets: Set<String> = DEFAULT_TARGETS.toSet()

    private var foregroundPkg: String? = null
    private var lastEventQuery = 0L
    private var watchedSec = 0
    private var shownStage = -1

    private val tick = object : Runnable {
        override fun run() {
            try {
                step()
            } catch (e: Exception) {
                Log.w(TAG, "tick failed", e)
            }
            handler.postDelayed(this, TICK_MS)
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        loadConfig(intent)
        Log.i(TAG, "start: appearAfter=${appearAfterSec}s growEvery=${growEverySec}s targets=$targets pet=$petUri")
        startAsForeground()
        if (!isRunning) {
            isRunning = true
            lastEventQuery = System.currentTimeMillis() - 60_000L
            handler.post(tick)
        }
        // 펫이 바뀌었을 수 있으니 이미지를 다시 읽는다.
        loadPetBitmap()
        return START_STICKY
    }

    override fun onDestroy() {
        isRunning = false
        handler.removeCallbacks(tick)
        hidePet()
        super.onDestroy()
    }

    // ---- 설정 ----

    private fun loadConfig(intent: Intent?) {
        val prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        if (intent != null && intent.hasExtra(EXTRA_APPEAR_AFTER)) {
            // 앱에서 켤 때 넘어온 값을 저장해 두고, 시스템이 서비스를 다시 살릴 때(START_STICKY) 쓴다.
            val list = intent.getStringArrayExtra(EXTRA_TARGETS)
            prefs.edit()
                .putString(EXTRA_PET_URI, intent.getStringExtra(EXTRA_PET_URI))
                .putInt(EXTRA_APPEAR_AFTER, intent.getIntExtra(EXTRA_APPEAR_AFTER, 60))
                .putInt(EXTRA_GROW_EVERY, intent.getIntExtra(EXTRA_GROW_EVERY, 30))
                .putString(EXTRA_TARGETS, (list ?: DEFAULT_TARGETS).joinToString(","))
                .apply()
        }
        petUri = prefs.getString(EXTRA_PET_URI, null)
        appearAfterSec = prefs.getInt(EXTRA_APPEAR_AFTER, 60).coerceAtLeast(1)
        growEverySec = prefs.getInt(EXTRA_GROW_EVERY, 30).coerceAtLeast(1)
        targets = prefs.getString(EXTRA_TARGETS, null)
            ?.split(",")?.filter { it.isNotBlank() }?.toSet()
            ?: DEFAULT_TARGETS.toSet()
    }

    // ---- 포그라운드 알림 ----

    private fun startAsForeground() {
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            nm.createNotificationChannel(
                NotificationChannel(CHANNEL_ID, "펫 지킴이", NotificationManager.IMPORTANCE_LOW).apply {
                    description = "숏폼을 오래 보면 펫이 나타나요"
                    setShowBadge(false)
                }
            )
        }
        val open = PendingIntent.getActivity(
            this, 0,
            Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, CHANNEL_ID)
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(this)
        }
        val notification = builder
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("펫이 함께 지켜보고 있어요")
            .setContentText("숏폼을 오래 보면 펫이 나타나요")
            .setContentIntent(open)
            .setOngoing(true)
            .build()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    // ---- 감지 ----

    private fun step() {
        updateForegroundApp()
        val watching = foregroundPkg != null && targets.contains(foregroundPkg)
        if (!watching) {
            watchedSec = 0
            hidePet()
            return
        }
        watchedSec += 1
        if (watchedSec < appearAfterSec) return
        if (!Settings.canDrawOverlays(this)) { // 권한이 꺼져 있으면 조용히 기다린다
            if (watchedSec == appearAfterSec) Log.w(TAG, "no overlay permission")
            return
        }

        val stage = ((watchedSec - appearAfterSec) / growEverySec).coerceAtMost(STAGE_SCALES.size - 1)
        if (stage != shownStage) {
            showPet(stage)
            if (stage > 0) vibrate(stage)
        }
    }

    /** 마지막으로 앞에 올라온 앱을 사용 이벤트로 추적한다. */
    private fun updateForegroundApp() {
        val usm = getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
        val now = System.currentTimeMillis()
        val events = usm.queryEvents(lastEventQuery, now)
        val event = UsageEvents.Event()
        while (events.hasNextEvent()) {
            events.getNextEvent(event)
            val resumed = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                event.eventType == UsageEvents.Event.ACTIVITY_RESUMED
            } else {
                @Suppress("DEPRECATION")
                event.eventType == UsageEvents.Event.MOVE_TO_FOREGROUND
            }
            if (resumed && event.packageName != foregroundPkg) {
                foregroundPkg = event.packageName
                Log.i(TAG, "foreground: $foregroundPkg (target=${targets.contains(foregroundPkg)})")
            }
        }
        lastEventQuery = now
    }

    // ---- 펫 표시 ----

    private fun showPet(stage: Int) {
        val bitmap = petBitmap ?: fallbackBitmap()
        val sizePx = (BASE_SIZE_DP * STAGE_SCALES[stage] * resources.displayMetrics.density).toInt()
        // 픽셀 아트가 뭉개지지 않게 가장 가까운 픽셀로 확대(filter = false)
        val scaled = Bitmap.createScaledBitmap(
            bitmap, sizePx, (sizePx * bitmap.height.toFloat() / bitmap.width).toInt(), false,
        )

        val view = petView ?: ImageView(this).also { iv ->
            iv.setOnClickListener {
                // 펫을 누르면 펫톡스로 — 숏폼에서 잠깐 벗어나게 한다
                startActivity(Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            }
        }
        view.setImageBitmap(scaled)

        val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_PHONE
        }
        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            type,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT,
        ).apply {
            // 1단계는 오른쪽 아래 구석, 커질수록 화면 가운데 쪽으로 올라와 영상을 더 가린다
            gravity = if (stage >= 2) Gravity.CENTER else Gravity.BOTTOM or Gravity.END
            val margin = (24 * resources.displayMetrics.density).toInt()
            x = if (stage >= 2) 0 else margin
            y = if (stage >= 2) 0 else margin * 5
        }

        try {
            if (petView == null) {
                windowManager.addView(view, params)
                petView = view
            } else {
                windowManager.updateViewLayout(view, params)
            }
            shownStage = stage
            Log.i(TAG, "pet shown: stage=$stage size=${sizePx}px")
        } catch (e: Exception) {
            Log.w(TAG, "overlay add/update failed", e)
        }
    }

    private fun hidePet() {
        val view = petView ?: return
        try {
            windowManager.removeView(view)
        } catch (e: Exception) {
            Log.w(TAG, "overlay remove failed", e)
        }
        petView = null
        shownStage = -1
    }

    private fun vibrate(stage: Int) {
        val vibrator = getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator ?: return
        val ms = 120L + stage * 80L
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            vibrator.vibrate(VibrationEffect.createOneShot(ms, VibrationEffect.DEFAULT_AMPLITUDE))
        } else {
            @Suppress("DEPRECATION")
            vibrator.vibrate(ms)
        }
    }

    // ---- 펫 이미지 ----

    /**
     * JS 에서 넘겨준 이미지 주소를 읽는다.
     * - 개발 모드: Metro 서버 주소(http://…/assets/…png)
     * - 배포 빌드: drawable 리소스 이름(src_assets_images_pets_home_golden)
     * - 사진으로 만든 캐릭터: file:// 또는 content://
     */
    private fun loadPetBitmap() {
        val uri = petUri ?: return
        thread(name = "petox-overlay-pet") {
            val bmp = try {
                when {
                    uri.startsWith("http") -> URL(uri).openStream().use { BitmapFactory.decodeStream(it) }
                    uri.startsWith("file:") || uri.startsWith("content:") ->
                        contentResolver.openInputStream(Uri.parse(uri))?.use { BitmapFactory.decodeStream(it) }
                    else -> {
                        val id = resources.getIdentifier(uri, "drawable", packageName)
                        if (id != 0) BitmapFactory.decodeResource(resources, id) else null
                    }
                }
            } catch (e: Exception) {
                Log.w(TAG, "pet image load failed: $uri", e)
                null
            }
            if (bmp != null) {
                handler.post {
                    petBitmap = bmp
                    if (shownStage >= 0) {
                        val stage = shownStage
                        shownStage = -1
                        showPet(stage)
                    }
                }
            }
        }
    }

    private fun fallbackBitmap(): Bitmap =
        BitmapFactory.decodeResource(resources, R.mipmap.ic_launcher)
}
