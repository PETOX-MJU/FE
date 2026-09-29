package com.petoxmju.petox.overlay

import android.animation.Animator
import android.animation.AnimatorListenerAdapter
import android.animation.ValueAnimator
import android.app.Activity
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
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.ImageReader
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.IBinder
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import android.provider.Settings
import android.util.Log
import android.view.Gravity
import android.view.WindowManager
import android.view.animation.LinearInterpolator
import android.widget.ImageView
import com.petoxmju.petox.MainActivity
import com.petoxmju.petox.R
import java.net.URL
import kotlin.concurrent.thread

/**
 * 숏폼 앱을 보고 있으면 내 펫을 다른 앱 위에 띄우는 포그라운드 서비스.
 *
 * 1초마다 UsageStatsManager 로 "지금 앞에 떠 있는 앱"을 확인한다.
 * - 대상 앱(유튜브·인스타·틱톡)을 appearAfterSec 초 이상 연속으로 보면 펫이 화면 오른쪽 밖에서
 *   걸어 들어와(걷기 프레임이 있을 때) 오른쪽 아래에 앉는다.
 * - 계속 보면 growEverySec 초마다 펫이 한 단계씩 커지고(최대 4단계) 진동한다.
 * - 대상 앱을 벗어나면 펫이 사라지고 시간도 처음부터 다시 센다.
 * - 펫을 누르면 펫톡스 앱이 열린다.
 *
 * 숏폼 화면 판별: 사용자가 화면 캡처(MediaProjection)를 허용했으면, 대상 앱이 앞에 있을 때만
 * 1초에 한 장 화면을 작게 떠서 AI 숏폼 분류기(ShortsClassifier)에 넣는다. 최근 SHORTS_WINDOW 장의
 * 평균 점수가 SHORTS_THRESHOLD 이상일 때만 "숏폼을 보는 중"으로 센다 (유튜브 홈·일반 영상은 제외).
 * 프레임은 메모리에서만 쓰고 바로 버린다. 캡처를 허용하지 않았거나 모델을 못 읽으면
 * 예전처럼 앱 단위로 감지한다.
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
        const val EXTRA_WALK_FRAMES = "walkFrames"
        const val EXTRA_WALK_RATIO = "walkWidthRatio"
        const val EXTRA_CAPTURE_CODE = "captureResultCode"
        const val EXTRA_CAPTURE_DATA = "captureData"

        /**
         * 숏폼 판정 — 최근 몇 장(1초 간격)의 평균 점수가 임계값 이상이면 숏폼.
         * AI 저장소 eval.py 가 모델과 함께 정한 값을 반올림하지 말고 그대로 넣는다 (README 「앱 연동 메모」).
         * TODO(현식): 릴리스 노트의 추천 임계값·창 크기로 바꾸기. 지금은 eval.py 기본 창 5, 임계값 0.5.
         */
        private const val SHORTS_WINDOW = 5
        private const val SHORTS_THRESHOLD = 0.5f
        /** 펫이 떠 있는 동안 숏폼이 아니라고 나와도 이만큼(초)은 봐준다 — 펫이 화면에 찍혀 점수가 흔들려도 깜박이지 않게 */
        private const val HIDE_AFTER_SEC = 4
        /** 캡처 해상도 = 화면 / 이 값 (모델 입력이 448×224 라 크게 뜰 필요가 없다) */
        private const val CAPTURE_DOWNSCALE = 4

        /** 걷기 한 프레임 시간, 화면 밖 → 자리까지 걷는 시간 */
        private const val WALK_FRAME_MS = 150L
        private const val WALK_IN_MS = 2200L

        @Volatile
        var isRunning = false
            private set

        /** 화면 캡처로 숏폼 화면을 판별하고 있는가 */
        @Volatile
        var isCapturing = false
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
    private var walkUris: List<String> = emptyList()
    private var walkBitmaps: List<Bitmap> = emptyList()
    /** 앉은 펫 너비 대비 걷는 펫 너비 — 도트 한 칸 크기를 같게 (JS 가 견종별로 계산) */
    private var walkWidthRatio = 1.25f

    // 걸어 들어오는 중인 창과 애니메이션
    private var walkView: ImageView? = null
    private var walkAnimator: ValueAnimator? = null
    private var walkFrame = 0
    private val walkFrameTick = object : Runnable {
        override fun run() {
            val view = walkView ?: return
            val frames = walkScaled
            if (frames.isEmpty()) return
            walkFrame = (walkFrame + 1) % frames.size
            view.setImageBitmap(frames[walkFrame])
            handler.postDelayed(this, WALK_FRAME_MS)
        }
    }
    private var walkScaled: List<Bitmap> = emptyList()
    private var appearAfterSec = 60
    private var growEverySec = 30
    private var targets: Set<String> = DEFAULT_TARGETS.toSet()

    // ---- 숏폼 판별 (화면 캡처 + 분류기) ----
    private var projection: MediaProjection? = null
    private var virtualDisplay: VirtualDisplay? = null
    private var imageReader: ImageReader? = null
    private var classifier: ShortsClassifier? = null
    private val inferThread = HandlerThread("petox-shorts").apply { start() }
    private val inferHandler = Handler(inferThread.looper)
    @Volatile private var inferBusy = false
    /** 지금 앱에서 모은 최근 점수 (메인 스레드에서만 만진다) */
    private val recentScores = ArrayDeque<Float>()
    private var shortsNow = false
    private var notShortsSec = 0

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
        startAsForeground(withCapture = projection != null)
        maybeStartCapture(intent)
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
        stopCapture("service destroyed")
        // 판별 중이던 한 장이 끝난 뒤 닫는다 (같은 스레드에 줄 세움)
        val model = classifier
        classifier = null
        inferHandler.post { model?.close() }
        inferThread.quitSafely()
        super.onDestroy()
    }

    // ---- 설정 ----

    private fun loadConfig(intent: Intent?) {
        val prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        if (intent != null && intent.hasExtra(EXTRA_APPEAR_AFTER)) {
            // 앱에서 켤 때 넘어온 값을 저장해 두고, 시스템이 서비스를 다시 살릴 때(START_STICKY) 쓴다.
            val list = intent.getStringArrayExtra(EXTRA_TARGETS)
            val walk = intent.getStringArrayExtra(EXTRA_WALK_FRAMES)
            prefs.edit()
                .putString(EXTRA_WALK_FRAMES, walk?.joinToString("\n") ?: "")
                .putFloat(EXTRA_WALK_RATIO, intent.getFloatExtra(EXTRA_WALK_RATIO, 1.25f))
                .putString(EXTRA_PET_URI, intent.getStringExtra(EXTRA_PET_URI))
                .putInt(EXTRA_APPEAR_AFTER, intent.getIntExtra(EXTRA_APPEAR_AFTER, 60))
                .putInt(EXTRA_GROW_EVERY, intent.getIntExtra(EXTRA_GROW_EVERY, 30))
                .putString(EXTRA_TARGETS, (list ?: DEFAULT_TARGETS).joinToString(","))
                .apply()
        }
        petUri = prefs.getString(EXTRA_PET_URI, null)
        appearAfterSec = prefs.getInt(EXTRA_APPEAR_AFTER, 60).coerceAtLeast(1)
        growEverySec = prefs.getInt(EXTRA_GROW_EVERY, 30).coerceAtLeast(1)
        walkWidthRatio = prefs.getFloat(EXTRA_WALK_RATIO, 1.25f).coerceIn(0.5f, 3f)
        walkUris = prefs.getString(EXTRA_WALK_FRAMES, null)
            ?.split("\n")?.filter { it.isNotBlank() } ?: emptyList()
        targets = prefs.getString(EXTRA_TARGETS, null)
            ?.split(",")?.filter { it.isNotBlank() }?.toSet()
            ?: DEFAULT_TARGETS.toSet()
    }

    // ---- 포그라운드 알림 ----

    private fun startAsForeground(withCapture: Boolean) {
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
        // 화면 캡처를 쓰려면 서비스가 mediaProjection 유형으로 떠 있어야 한다 (Android 10+)
        val capture = if (withCapture) ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION else 0
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE or capture)
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && withCapture) {
            startForeground(NOTIFICATION_ID, notification, capture)
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    // ---- 화면 캡처 (숏폼 판별용) ----

    /** 앱이 방금 받은 화면 캡처 허용 결과가 넘어왔으면 캡처를 시작한다 (허용 결과는 한 번만 쓸 수 있다) */
    private fun maybeStartCapture(intent: Intent?) {
        if (intent == null || projection != null) return
        val code = intent.getIntExtra(EXTRA_CAPTURE_CODE, 0)
        val data: Intent? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            intent.getParcelableExtra(EXTRA_CAPTURE_DATA, Intent::class.java)
        } else {
            @Suppress("DEPRECATION")
            intent.getParcelableExtra(EXTRA_CAPTURE_DATA)
        }
        if (code != Activity.RESULT_OK || data == null) return

        val model = classifier ?: try {
            ShortsClassifier(this).also {
                classifier = it
                Log.i(TAG, "shorts classifier loaded: input=${it.inputSize}")
            }
        } catch (e: Throwable) {
            Log.w(TAG, "shorts classifier load failed — 앱 단위 감지로 동작", e)
            return
        }

        try {
            startAsForeground(withCapture = true) // getMediaProjection 보다 먼저
            val mpm = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
            val mp = mpm.getMediaProjection(code, data) ?: return
            mp.registerCallback(object : MediaProjection.Callback() {
                override fun onStop() {
                    handler.post { stopCapture("projection stopped") }
                }
            }, handler)
            val metrics = resources.displayMetrics
            val w = (metrics.widthPixels / CAPTURE_DOWNSCALE).coerceAtLeast(1)
            val h = (metrics.heightPixels / CAPTURE_DOWNSCALE).coerceAtLeast(1)
            val reader = ImageReader.newInstance(w, h, PixelFormat.RGBA_8888, 2)
            projection = mp
            imageReader = reader
            virtualDisplay = mp.createVirtualDisplay(
                "petox-shorts", w, h, (metrics.densityDpi / CAPTURE_DOWNSCALE).coerceAtLeast(1),
                DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR, reader.surface, null, inferHandler,
            )
            isCapturing = true
            Log.i(TAG, "screen capture started ${w}x$h (model ${model.inputSize})")
        } catch (e: Exception) {
            Log.w(TAG, "screen capture start failed — 앱 단위 감지로 동작", e)
            stopCapture("start failed")
        }
    }

    private fun stopCapture(reason: String) {
        if (projection == null && virtualDisplay == null && imageReader == null) return
        Log.i(TAG, "screen capture stopped: $reason")
        isCapturing = false
        virtualDisplay?.release()
        virtualDisplay = null
        val mp = projection
        projection = null
        try { mp?.stop() } catch (e: Exception) { Log.w(TAG, "projection stop failed", e) }
        imageReader?.close()
        imageReader = null
        recentScores.clear()
        shortsNow = false
    }

    /** 지금 화면 한 장을 분류기에 넣는다 (별도 스레드). 앞의 판별이 안 끝났으면 건너뛴다. */
    private fun requestClassify(pkg: String) {
        val reader = imageReader ?: return
        val model = classifier ?: return
        if (inferBusy) return
        inferBusy = true
        inferHandler.post {
            try {
                val image = reader.acquireLatestImage()
                if (image != null) {
                    val frame = try { image.toBitmap() } finally { image.close() }
                    val score = model.score(frame)
                    frame.recycle()
                    handler.post { pushScore(pkg, score) }
                }
            } catch (e: Exception) {
                Log.w(TAG, "classify failed", e)
            } finally {
                inferBusy = false
            }
        }
    }

    private fun pushScore(pkg: String, score: Float) {
        if (pkg != foregroundPkg) return // 그새 앱이 바뀌었다
        recentScores.addLast(score)
        while (recentScores.size > SHORTS_WINDOW) recentScores.removeFirst()
        // N장이 모이기 전에는 숏폼으로 판정하지 않는다 (README)
        val avg = if (recentScores.size < SHORTS_WINDOW) 0f else recentScores.average().toFloat()
        val next = recentScores.size >= SHORTS_WINDOW && avg >= SHORTS_THRESHOLD
        // 한 장마다 점수를 남긴다 — 임계값 맞출 때 logcat 으로 본다 (adb logcat -s PetoxOverlay)
        Log.d(TAG, "score=${"%.3f".format(score)} avg=${"%.3f".format(avg)} n=${recentScores.size}")
        if (next != shortsNow) Log.i(TAG, "shorts=$next avg=${"%.3f".format(avg)} ($pkg)")
        shortsNow = next
    }

    // ---- 감지 ----

    private fun step() {
        UsageLog.markAlive(this)
        updateForegroundApp()
        val pkg = foregroundPkg
        val inTarget = pkg != null && targets.contains(pkg)
        val classifying = isCapturing && classifier != null
        if (inTarget && classifying) requestClassify(pkg!!)

        val petOnScreen = shownStage >= 0 || walkView != null
        val watching = when {
            !inTarget -> false
            !classifying -> true // 캡처를 허용 안 했으면 예전처럼 앱 단위
            shortsNow -> true
            petOnScreen -> ++notShortsSec < HIDE_AFTER_SEC // 잠깐 흔들린 건 봐준다
            else -> false
        }
        if (!classifying || shortsNow) notShortsSec = 0

        // 서버 미션용 기록 — 숏폼을 본 1초 (캡처를 안 쓰면 대상 앱을 본 1초). 화면이 꺼져 있으면 안 센다.
        if (inTarget && (!classifying || shortsNow) && screenOn()) {
            UsageLog.addShortsSecond(this, pkg!!)
        }

        if (!watching) {
            watchedSec = 0
            notShortsSec = 0
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
        if (walkView != null) return // 걸어 들어오는 중 — 끝나면 앉은 모습으로 바뀐다
        if (stage != shownStage) {
            // 서버 미션용 기록 — 펫이 처음 나타날 때(걸어 들어오기 시작 포함) 1회
            if (shownStage == -1) UsageLog.addPetCall(this)
            if (shownStage == -1 && walkBitmaps.isNotEmpty()) {
                startWalkIn()
                return
            }
            showPet(stage)
            if (stage > 0) vibrate(stage)
        }
    }

    private fun screenOn(): Boolean =
        (getSystemService(Context.POWER_SERVICE) as android.os.PowerManager).isInteractive

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
                // 앱이 바뀌면 점수를 처음부터 모은다 (README)
                recentScores.clear()
                shortsNow = false
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

    /** 화면 오른쪽 밖에서 왼쪽으로 걸어 들어와 앉을 자리에서 멈춘 뒤, 앉은 펫으로 바꾼다. */
    private fun startWalkIn() {
        val density = resources.displayMetrics.density
        // 앉은 펫(1단계) 너비 × 비율 — 걷다가 앉아도 도트 크기가 그대로다
        val widthPx = (BASE_SIZE_DP * STAGE_SCALES[0] * walkWidthRatio * density).toInt()
        walkScaled = walkBitmaps.map {
            Bitmap.createScaledBitmap(it, widthPx, (widthPx * it.height.toFloat() / it.width).toInt(), false)
        }
        val view = ImageView(this).apply {
            setImageBitmap(walkScaled[0])
            setOnClickListener {
                startActivity(Intent(this@OverlayService, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            }
        }
        val margin = (24 * density).toInt()
        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            overlayType(),
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
                WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS, // 화면 밖에서 시작하려면 필요
            PixelFormat.TRANSLUCENT,
        ).apply {
            gravity = Gravity.BOTTOM or Gravity.END
            x = -widthPx // 오른쪽 가장자리 바깥
            y = margin * 5
        }
        try {
            windowManager.addView(view, params)
        } catch (e: Exception) {
            Log.w(TAG, "walk add failed", e)
            showPet(0)
            return
        }
        walkView = view
        walkFrame = 0
        handler.postDelayed(walkFrameTick, WALK_FRAME_MS)
        walkAnimator = ValueAnimator.ofInt(-widthPx, margin).apply {
            duration = WALK_IN_MS
            interpolator = LinearInterpolator()
            addUpdateListener {
                params.x = it.animatedValue as Int
                try {
                    windowManager.updateViewLayout(view, params)
                } catch (e: Exception) {
                    // 창이 이미 사라졌으면(앱을 벗어남) 무시
                }
            }
            addListener(object : AnimatorListenerAdapter() {
                private var cancelled = false
                override fun onAnimationCancel(animation: Animator) {
                    cancelled = true
                }
                override fun onAnimationEnd(animation: Animator) {
                    if (cancelled) return
                    stopWalk()
                    showPet(0) // 도착 — 앉은 모습
                }
            })
            start()
        }
        Log.i(TAG, "pet walking in (${walkBitmaps.size} frames)")
    }

    private fun stopWalk() {
        walkAnimator?.cancel()
        walkAnimator = null
        handler.removeCallbacks(walkFrameTick)
        val view = walkView ?: return
        try {
            windowManager.removeView(view)
        } catch (e: Exception) {
            Log.w(TAG, "walk remove failed", e)
        }
        walkView = null
    }

    private fun overlayType(): Int =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_PHONE
        }

    private fun hidePet() {
        stopWalk()
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
        val uri = petUri
        val walk = walkUris
        thread(name = "petox-overlay-pet") {
            val bmp = uri?.let { decodeUri(it) }
            val frames = walk.mapNotNull { decodeUri(it) }
            handler.post {
                // 프레임이 하나라도 빠지면 걷기는 건너뛴다 (뚝뚝 끊겨 보이지 않게)
                walkBitmaps = if (frames.size == walk.size) frames else emptyList()
                if (bmp != null) {
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

    private fun decodeUri(uri: String): Bitmap? =
        try {
            when {
                uri.startsWith("http") -> URL(uri).openStream().use { BitmapFactory.decodeStream(it) }
                uri.startsWith("file:") || uri.startsWith("content:") ->
                    contentResolver.openInputStream(Uri.parse(uri))?.use { BitmapFactory.decodeStream(it) }
                else -> {
                    val id = resources.getIdentifier(uri, "drawable", packageName)
                    // 배포 빌드의 drawable 은 밀도에 맞춰 부드럽게 확대되면 도트가 뭉개져서 원본 크기로 읽는다
                    if (id != 0) {
                        BitmapFactory.decodeResource(resources, id, BitmapFactory.Options().apply { inScaled = false })
                    } else {
                        null
                    }
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "image load failed: $uri", e)
            null
        }

    private fun fallbackBitmap(): Bitmap =
        BitmapFactory.decodeResource(resources, R.mipmap.ic_launcher)
}
