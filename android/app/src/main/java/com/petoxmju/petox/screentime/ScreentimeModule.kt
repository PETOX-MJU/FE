package com.petoxmju.petox.screentime

import android.app.AppOpsManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Process
import android.provider.Settings
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.uimanager.ViewManager
import com.petox.screentime.AnalysisInput
import com.petox.screentime.AnalysisJson
import com.petox.screentime.MINUTE_MS
import com.petox.screentime.Profile
import com.petox.screentime.Window
import com.petox.screentime.WindowAggregate
import com.petox.screentime.WindowKind
import com.petox.screentime.analyze
import com.petox.screentime.dailyWindow
import com.petox.screentime.nightWindows
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.ZoneId
import java.time.temporal.TemporalAdjusters
import kotlin.concurrent.thread

private const val MEASUREMENT_VERSION = "android-events-v1"
private const val PROFILE_VERSION = 1L
private const val DAY_MS = 24 * 60 * 60 * 1000L

/**
 * 폰 안에서 사용 기록을 모아 스크린타임 분석기(com.petox.screentime)를 돌린다.
 * 사용 기록은 기기 밖으로 나가지 않는다 (android-data-contract.md 6절).
 */
class ScreentimeModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
    override fun getName() = "PetoxScreentime"

    @ReactMethod
    fun hasUsageAccess(promise: Promise) {
        val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
        val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            appOps.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName)
        } else {
            @Suppress("DEPRECATION")
            appOps.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName)
        }
        promise.resolve(mode == AppOpsManager.MODE_ALLOWED)
    }

    @ReactMethod
    fun openUsageAccessSettings() {
        context.startActivity(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    /**
     * 지난 한 주(끝난 월~일)를 리포트 주로, 그 전 주를 비교 주로 분석해 AnalysisOutput JSON 문자열로 돌려준다.
     * 진행 중인 이번 주 기록은 다음 리포트에 들어간다.
     */
    @ReactMethod
    fun analyzeLastWeek(settings: ReadableMap, promise: Promise) {
        thread(name = "petox-screentime") {
            try {
                promise.resolve(runAnalysis(settings))
            } catch (e: Exception) {
                promise.reject("ANALYSIS_FAILED", e.message, e)
            }
        }
    }

    private fun runAnalysis(settings: ReadableMap): String {
        val zone = ZoneId.systemDefault()
        val now = System.currentTimeMillis()
        val weekStart = LocalDate.now(zone).with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)).minusDays(7)
        val previousWeekStart = weekStart.minusDays(7)
        val dailyTargetMs = settings.getInt("dailyTargetMinutes") * MINUTE_MS
        val nightTargetMs = settings.getInt("nightTargetMinutes") * MINUTE_MS
        val profile = Profile(
            version = PROFILE_VERSION,
            timezone = zone.id,
            targetPackages = settings.getArray("targetPackages")!!.toArrayList().map { it as String },
            weekdayBed = settings.getString("weekdayBed")!!,
            weekdayWake = settings.getString("weekdayWake")!!,
            weekendBed = settings.getString("weekendBed")!!,
            weekendWake = settings.getString("weekendWake")!!,
            temporaryDailyMs = dailyTargetMs,
            temporaryNightMs = nightTargetMs,
            finalDailyMs = dailyTargetMs,
            finalNightMs = nightTargetMs,
            effectiveFrom = previousWeekStart,
        )

        val anchors = (0L until 14L).map { previousWeekStart.plusDays(it) }
        // 첫 구간의 시작 상태(화면·잠금·전경 앱)를 되짚도록 하루 앞부터 조회한다.
        val queryStart = dailyWindow(anchors.first(), profile).startMs - DAY_MS
        val events = readEvents(queryStart, now)
        val collected = UsageIntervals.collect(events, now, excludedPackages())
        val dataFrom = events.minOfOrNull { it.timeMs }
        val aggregates = anchors.flatMap { day ->
            val (preBed, afterBed) = nightWindows(day, profile)
            listOf(
                WindowKind.DAILY to dailyWindow(day, profile),
                WindowKind.PRE_BED to preBed,
                WindowKind.AFTER_BED to afterBed,
            ).mapNotNull { (kind, window) -> aggregate(day, kind, window, collected, now, dataFrom) }
        }

        val input = AnalysisInput(
            asOfMs = now,
            lastCollectionAttemptMs = now,
            weekStart = weekStart,
            profile = profile,
            aggregates = aggregates,
            missions = emptyList(),
            currentDailyTargetMs = dailyTargetMs,
            currentNightTargetMs = nightTargetMs,
        )
        return AnalysisJson.encodeOutput(analyze(input))
    }

    private fun aggregate(
        day: LocalDate,
        kind: WindowKind,
        window: Window,
        collected: Collected,
        now: Long,
        dataFrom: Long?,
    ): WindowAggregate? {
        val usage = UsageIntervals.windowUsage(collected, window, now, dataFrom) ?: return null
        return WindowAggregate(
            anchorDate = day,
            kind = kind,
            startMs = window.startMs,
            endMs = window.endMs,
            observedUntilMs = usage.observedUntilMs,
            quality = usage.quality,
            profileVersion = PROFILE_VERSION,
            apps = usage.apps,
            measurementVersion = MEASUREMENT_VERSION,
        )
    }

    private fun readEvents(start: Long, end: Long): List<UsageEvent> {
        val manager = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
        val raw = manager.queryEvents(start, end)
        val event = UsageEvents.Event()
        val out = mutableListOf<UsageEvent>()
        while (raw.hasNextEvent()) {
            raw.getNextEvent(event)
            // 상수 값으로 비교한다 — 일부는 API 28/29 에 추가돼 minSdk 24 에서 참조할 수 없다.
            val type = when (event.eventType) {
                1 -> EventType.RESUMED // ACTIVITY_RESUMED
                2 -> EventType.PAUSED // ACTIVITY_PAUSED
                15 -> EventType.SCREEN_ON // SCREEN_INTERACTIVE
                16 -> EventType.SCREEN_OFF // SCREEN_NON_INTERACTIVE
                17 -> EventType.KEYGUARD_SHOWN
                18 -> EventType.KEYGUARD_HIDDEN
                26 -> EventType.SHUTDOWN // DEVICE_SHUTDOWN
                27 -> EventType.STARTUP // DEVICE_STARTUP
                else -> null
            } ?: continue
            out.add(UsageEvent(event.timeStamp, type, event.packageName ?: "", event.className ?: ""))
        }
        return out
    }

    /** 자기 앱·홈 런처·시스템 UI 는 사용량에서 뺀다. 다른 앱을 이름으로 추측해 빼지 않는다. */
    private fun excludedPackages(): Set<String> {
        val home = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME)
        val launcher = context.packageManager.resolveActivity(home, 0)?.activityInfo?.packageName
        return setOfNotNull(context.packageName, launcher, "com.android.systemui")
    }
}

class ScreentimePackage : ReactPackage {
    override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> =
        listOf(ScreentimeModule(context))

    override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
