package com.petoxmju.petox.screentime

import com.petox.screentime.AppDuration
import com.petox.screentime.Quality
import com.petox.screentime.Window

/**
 * UsageStatsManager 이벤트를 앱별 전경 사용 구간으로 바꾸는 순수 로직.
 * Android API 에 의존하지 않아 JVM 테스트로 검증한다 (android-data-contract.md 2~3절).
 */
enum class EventType { RESUMED, PAUSED, SCREEN_ON, SCREEN_OFF, KEYGUARD_SHOWN, KEYGUARD_HIDDEN, SHUTDOWN }

data class UsageEvent(
    val timeMs: Long,
    val type: EventType,
    val packageName: String = "",
    /** 같은 앱 안의 Activity 구분용 (클래스 이름) */
    val activity: String = "",
)

data class Span(val start: Long, val end: Long)

data class WindowUsage(val quality: Quality, val observedUntilMs: Long, val apps: List<AppDuration>?)

object UsageIntervals {
    /**
     * 앱별 사용 구간(합집합) 중 "화면 켜짐 + 잠금 해제" 인 부분만 남긴다.
     * - 같은 앱의 Activity A/B 가 겹쳐도 한 번만 센다 (F13)
     * - 잠금·화면 꺼짐 동안은 전경 앱이 남아 있어도 제외한다 (F22)
     * - 시작 이벤트 없이 끝난 구간은 앞으로 늘리지 않는다 (F15)
     */
    fun perApp(events: List<UsageEvent>, queryEndMs: Long, excluded: Set<String>): Map<String, List<Span>> {
        val sorted = events.sortedBy { it.timeMs }
        val usable = usableSpans(sorted, queryEndMs)

        val open = HashMap<Pair<String, String>, Long>()
        val raw = HashMap<String, MutableList<Span>>()
        fun close(key: Pair<String, String>, at: Long) {
            val start = open.remove(key) ?: return
            if (at > start) raw.getOrPut(key.first) { mutableListOf() }.add(Span(start, at))
        }
        for (event in sorted) {
            when (event.type) {
                EventType.RESUMED -> if (event.packageName !in excluded) {
                    open.putIfAbsent(event.packageName to event.activity, event.timeMs)
                }
                EventType.PAUSED -> close(event.packageName to event.activity, event.timeMs)
                EventType.SHUTDOWN -> open.keys.toList().forEach { close(it, event.timeMs) }
                else -> Unit
            }
        }
        open.keys.toList().forEach { close(it, queryEndMs) }

        return raw.mapValues { (_, spans) -> intersect(union(spans), usable) }
    }

    /** 한 구간의 앱별 합계와 품질. [dataFromMs] 는 조회된 첫 이벤트 시각(그 이전은 기록이 없다고 본다). */
    fun windowUsage(perApp: Map<String, List<Span>>, window: Window, nowMs: Long, dataFromMs: Long?): WindowUsage? {
        if (window.startMs >= nowMs) return null // 아직 시작 안 한 구간은 보내지 않는다
        val observedUntil = minOf(window.endMs, nowMs)
        if (dataFromMs == null || dataFromMs >= observedUntil) {
            return WindowUsage(Quality.UNAVAILABLE, observedUntil, null)
        }
        val from = maxOf(window.startMs, dataFromMs)
        val apps = perApp.mapNotNull { (pkg, spans) ->
            val ms = spans.sumOf { maxOf(0L, minOf(it.end, observedUntil) - maxOf(it.start, from)) }
            if (ms > 0) AppDuration(pkg, ms) else null
        }.sortedByDescending { it.durationMs }
        // ponytail: 재부팅·시계 변경 공백은 SHUTDOWN 이벤트로만 알아챈다. 이벤트 없이 끊긴 기록은
        // complete 로 과대 표시될 수 있다 — 체크포인트 기반 수집(WorkManager)이 붙으면 거기서 판정.
        val complete = window.endMs <= nowMs && dataFromMs <= window.startMs
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
