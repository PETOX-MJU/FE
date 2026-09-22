package com.petoxmju.petox.screentime

import com.petox.screentime.AppDuration
import com.petox.screentime.Quality
import com.petox.screentime.Window

/**
 * UsageStatsManager 이벤트를 앱별 전경 사용 구간으로 바꾸는 순수 로직.
 * Android API 에 의존하지 않아 JVM 테스트로 검증한다 (android-data-contract.md 2~3절).
 */
enum class EventType { RESUMED, PAUSED, SCREEN_ON, SCREEN_OFF, KEYGUARD_SHOWN, KEYGUARD_HIDDEN, SHUTDOWN, STARTUP }

data class UsageEvent(
    val timeMs: Long,
    val type: EventType,
    val packageName: String = "",
    /** 같은 앱 안의 Activity 구분용 (클래스 이름) */
    val activity: String = "",
)

data class Span(val start: Long, val end: Long)

data class WindowUsage(val quality: Quality, val observedUntilMs: Long, val apps: List<AppDuration>?)

/** 앱별 사용 구간과, 기기 상태를 알 수 없는 공백 구간 */
data class Collected(val perApp: Map<String, List<Span>>, val gaps: List<Span>)

// ponytail: 화면이 켜진 채 이벤트가 이만큼 끊기면 기기가 멈췄던 것으로 본다(스냅샷·강제 종료 등).
// 화면을 켠 채 영상을 몇 시간 보는 경우까지는 정상으로 둔다. 실기기 데이터로 조정할 값.
const val SILENT_GAP_MS = 4 * 60 * 60 * 1000L

object UsageIntervals {
    /**
     * 앱별 사용 구간(합집합) 중 "화면 켜짐 + 잠금 해제" 인 부분만 남긴다.
     * - 같은 앱의 Activity A/B 가 겹쳐도 한 번만 센다 (F13)
     * - 잠금·화면 꺼짐 동안은 전경 앱이 남아 있어도 제외한다 (F22)
     * - 시작 이벤트 없이 끝난 구간은 앞으로 늘리지 않는다 (F15)
     * - 끝 이벤트를 놓친 구간(다시 RESUMED 가 오거나 재부팅)은 끝을 모르므로 세지 않는다 (F15)
     */
    fun collect(events: List<UsageEvent>, queryEndMs: Long, excluded: Set<String>): Collected {
        val sorted = events.sortedBy { it.timeMs }
        val screenOn = usableSpans(sorted, queryEndMs)
        val gaps = silentGaps(sorted, screenOn)
        val usable = subtract(screenOn, gaps)

        val open = HashMap<Pair<String, String>, Long>()
        val raw = HashMap<String, MutableList<Span>>()
        fun close(key: Pair<String, String>, at: Long) {
            val start = open.remove(key) ?: return
            if (at > start) raw.getOrPut(key.first) { mutableListOf() }.add(Span(start, at))
        }
        for (event in sorted) {
            when (event.type) {
                // 이미 열려 있으면 PAUSED 를 놓친 것이다. 이전 시작 시각을 이어 쓰면 며칠짜리 구간이 된다.
                EventType.RESUMED -> if (event.packageName !in excluded) {
                    open[event.packageName to event.activity] = event.timeMs
                }
                EventType.PAUSED -> close(event.packageName to event.activity, event.timeMs)
                EventType.SHUTDOWN -> open.keys.toList().forEach { close(it, event.timeMs) }
                // 종료 이벤트 없이 부팅됐다(강제 종료 등). 열린 구간의 끝을 모르므로 버린다.
                EventType.STARTUP -> open.clear()
                else -> Unit
            }
        }
        open.keys.toList().forEach { close(it, queryEndMs) }

        return Collected(raw.mapValues { (_, spans) -> intersect(union(spans), usable) }, gaps)
    }

    /** 화면이 켜져 있는데 이벤트가 [SILENT_GAP_MS] 넘게 없는 구간 — 그 사이 기기 상태를 모른다. */
    private fun silentGaps(sorted: List<UsageEvent>, screenOn: List<Span>): List<Span> =
        sorted.zipWithNext()
            .filter { (a, b) -> b.timeMs - a.timeMs > SILENT_GAP_MS }
            .map { (a, b) -> Span(a.timeMs, b.timeMs) }
            .filter { gap -> screenOn.any { it.start <= gap.start && gap.start < it.end } }

    private fun subtract(spans: List<Span>, holes: List<Span>): List<Span> =
        holes.fold(spans) { acc, hole ->
            acc.flatMap { span ->
                if (hole.end <= span.start || hole.start >= span.end) listOf(span)
                else listOfNotNull(
                    Span(span.start, hole.start).takeIf { hole.start > span.start },
                    Span(hole.end, span.end).takeIf { hole.end < span.end },
                )
            }
        }

    /** 한 구간의 앱별 합계와 품질. [dataFromMs] 는 조회된 첫 이벤트 시각(그 이전은 기록이 없다고 본다). */
    fun windowUsage(collected: Collected, window: Window, nowMs: Long, dataFromMs: Long?): WindowUsage? {
        if (window.startMs >= nowMs) return null // 아직 시작 안 한 구간은 보내지 않는다
        val observedUntil = minOf(window.endMs, nowMs)
        if (dataFromMs == null || dataFromMs >= observedUntil) {
            return WindowUsage(Quality.UNAVAILABLE, observedUntil, null)
        }
        val from = maxOf(window.startMs, dataFromMs)
        val apps = collected.perApp.mapNotNull { (pkg, spans) ->
            val ms = spans.sumOf { maxOf(0L, minOf(it.end, observedUntil) - maxOf(it.start, from)) }
            if (ms > 0) AppDuration(pkg, ms) else null
        }.sortedByDescending { it.durationMs }
        // 상태를 모르는 공백이 걸친 구간은 일부만 확인된 것이다.
        val hasGap = collected.gaps.any { it.start < observedUntil && it.end > from }
        val complete = window.endMs <= nowMs && dataFromMs <= window.startMs && !hasGap
        return WindowUsage(if (complete) Quality.COMPLETE else Quality.PARTIAL, observedUntil, apps)
    }

    private fun usableSpans(sorted: List<UsageEvent>, queryEndMs: Long): List<Span> {
        val screenEvents = sorted.filter { it.type == EventType.SCREEN_ON || it.type == EventType.SCREEN_OFF }
        val lockEvents = sorted.filter { it.type == EventType.KEYGUARD_SHOWN || it.type == EventType.KEYGUARD_HIDDEN }
        // 첫 이벤트로 조회 시작 시점의 상태를 되짚는다: 처음 본 게 '꺼짐'이면 그 전엔 켜져 있었다.
        var interactive = screenEvents.firstOrNull()?.type != EventType.SCREEN_ON
        var locked = lockEvents.firstOrNull()?.type == EventType.KEYGUARD_HIDDEN
        var since: Long? = if (interactive && !locked) (sorted.firstOrNull()?.timeMs ?: queryEndMs) else null
        val spans = mutableListOf<Span>()
        for (event in sorted) {
            when (event.type) {
                EventType.SCREEN_ON -> interactive = true
                EventType.SCREEN_OFF, EventType.SHUTDOWN -> interactive = false
                EventType.STARTUP -> continue
                EventType.KEYGUARD_SHOWN -> locked = true
                EventType.KEYGUARD_HIDDEN -> locked = false
                else -> continue
            }
            val usableNow = interactive && !locked
            if (usableNow && since == null) since = event.timeMs
            if (!usableNow && since != null) {
                if (event.timeMs > since) spans.add(Span(since, event.timeMs))
                since = null
            }
        }
        since?.let { if (queryEndMs > it) spans.add(Span(it, queryEndMs)) }
        return spans
    }

    private fun union(spans: List<Span>): List<Span> {
        val merged = mutableListOf<Span>()
        for (span in spans.sortedBy { it.start }) {
            val last = merged.lastOrNull()
            if (last != null && span.start <= last.end) {
                merged[merged.lastIndex] = Span(last.start, maxOf(last.end, span.end))
            } else {
                merged.add(span)
            }
        }
        return merged
    }

    private fun intersect(a: List<Span>, b: List<Span>): List<Span> {
        val out = mutableListOf<Span>()
        var i = 0
        var j = 0
        while (i < a.size && j < b.size) {
            val start = maxOf(a[i].start, b[j].start)
            val end = minOf(a[i].end, b[j].end)
            if (start < end) out.add(Span(start, end))
            if (a[i].end < b[j].end) i++ else j++
        }
        return out
    }
}
