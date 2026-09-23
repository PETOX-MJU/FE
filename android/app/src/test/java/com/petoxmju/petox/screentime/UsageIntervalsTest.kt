package com.petoxmju.petox.screentime

import com.petox.screentime.Quality
import com.petox.screentime.Window
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

private const val MIN = 60_000L

class UsageIntervalsTest {
    private fun ev(min: Long, type: EventType, pkg: String = "", activity: String = "") =
        UsageEvent(min * MIN, type, pkg, activity)

    @Test
    fun `overlapping activities of one app count once (F13)`() {
        val events = listOf(
            ev(0, EventType.SCREEN_ON),
            ev(0, EventType.RESUMED, "yt", "A"),
            ev(5, EventType.RESUMED, "yt", "B"),
            ev(10, EventType.PAUSED, "yt", "A"),
            ev(10, EventType.PAUSED, "yt", "B"),
        )
        val spans = UsageIntervals.collect(events, 20 * MIN, emptySet()).perApp
        assertEquals(listOf(Span(0, 10 * MIN)), spans["yt"])
    }

    @Test
    fun `screen off and lock are excluded even if app stays resumed (F22)`() {
        val events = listOf(
            ev(0, EventType.SCREEN_ON),
            ev(0, EventType.RESUMED, "yt", "A"),
            ev(10, EventType.SCREEN_OFF),
            ev(30, EventType.SCREEN_ON),
            ev(30, EventType.KEYGUARD_SHOWN),
            ev(35, EventType.KEYGUARD_HIDDEN),
            ev(40, EventType.PAUSED, "yt", "A"),
        )
        val spans = UsageIntervals.collect(events, 60 * MIN, emptySet()).perApp
        assertEquals(listOf(Span(0, 10 * MIN), Span(35 * MIN, 40 * MIN)), spans["yt"])
    }

    @Test
    fun `excluded packages and pause without resume are not counted (F15)`() {
        val events = listOf(
            ev(0, EventType.SCREEN_ON),
            ev(1, EventType.PAUSED, "ig", "A"), // 조회 전부터 켜져 있던 앱 — 앞으로 늘리지 않는다
            ev(2, EventType.RESUMED, "launcher", "Home"),
            ev(3, EventType.PAUSED, "launcher", "Home"),
        )
        assertEquals(emptyMap<String, List<Span>>(), UsageIntervals.collect(events, 10 * MIN, setOf("launcher")).perApp)
    }

    @Test
    fun `missed pause or unclean reboot does not stretch a session (F15)`() {
        val events = listOf(
            ev(0, EventType.SCREEN_ON),
            ev(0, EventType.RESUMED, "ig", "Main"), // PAUSED 누락
            ev(600, EventType.RESUMED, "ig", "Main"),
            ev(601, EventType.PAUSED, "ig", "Main"),
            ev(700, EventType.RESUMED, "yt", "Main"), // 종료 이벤트 없이 재부팅
            ev(800, EventType.STARTUP),
        )
        val spans = UsageIntervals.collect(events, 900 * MIN, emptySet()).perApp
        assertEquals(listOf(Span(600 * MIN, 601 * MIN)), spans["ig"])
        assertNull(spans["yt"])
    }

    @Test
    fun `silence while screen is on is an unknown gap, not usage`() {
        val events = listOf(
            ev(0, EventType.SCREEN_ON),
            ev(0, EventType.RESUMED, "ig", "Main"),
            ev(10, EventType.SCREEN_ON), // 기기 상태가 이어지는지 모르는 3일 공백
            ev(3 * 24 * 60, EventType.SCREEN_ON),
            ev(3 * 24 * 60 + 1, EventType.SHUTDOWN),
        )
        val collected = UsageIntervals.collect(events, 3 * 24 * 60 * MIN + 10 * MIN, emptySet())
        assertEquals(listOf(Span(0, 10 * MIN), Span(3 * 24 * 60 * MIN, (3 * 24 * 60 + 1) * MIN)), collected.perApp["ig"])
        assertEquals(listOf(Span(10 * MIN, 3 * 24 * 60 * MIN)), collected.gaps)
    }

    @Test
    fun `screen-off silence at night is normal`() {
        val events = listOf(ev(0, EventType.SCREEN_OFF), ev(8 * 60, EventType.SCREEN_ON))
        assertEquals(emptyList<Span>(), UsageIntervals.collect(events, 9 * 60 * MIN, emptySet()).gaps)
    }

    @Test
    fun `window quality follows data coverage and progress`() {
        val t = 1_789_000_000_000L // Window 는 실제 epoch 범위만 받는다
        val perApp = Collected(mapOf("yt" to listOf(Span(t + 50 * MIN, t + 70 * MIN))), emptyList())
        val window = Window(t + 60 * MIN, t + 120 * MIN)

        val done = UsageIntervals.windowUsage(perApp, window, nowMs = t + 200 * MIN, dataFromMs = t)!!
        assertEquals(Quality.COMPLETE, done.quality)
        assertEquals(10 * MIN, done.apps!!.single().durationMs) // 구간 밖 50~60분은 잘린다

        val ongoing = UsageIntervals.windowUsage(perApp, window, nowMs = t + 65 * MIN, dataFromMs = t)!!
        assertEquals(Quality.PARTIAL, ongoing.quality)
        assertEquals(t + 65 * MIN, ongoing.observedUntilMs)

        val noData = UsageIntervals.windowUsage(perApp, window, nowMs = t + 200 * MIN, dataFromMs = t + 130 * MIN)!!
        assertEquals(Quality.UNAVAILABLE, noData.quality)
        assertNull(noData.apps)

        assertNull(UsageIntervals.windowUsage(perApp, Window(t + 300 * MIN, t + 400 * MIN), nowMs = t + 200 * MIN, dataFromMs = t))

        val gapped = perApp.copy(gaps = listOf(Span(t + 80 * MIN, t + 90 * MIN)))
        assertEquals(Quality.PARTIAL, UsageIntervals.windowUsage(gapped, window, nowMs = t + 200 * MIN, dataFromMs = t)!!.quality)
    }
}
