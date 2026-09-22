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
        val spans = UsageIntervals.perApp(events, 20 * MIN, emptySet())
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
        val spans = UsageIntervals.perApp(events, 60 * MIN, emptySet())
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
        assertEquals(emptyMap<String, List<Span>>(), UsageIntervals.perApp(events, 10 * MIN, setOf("launcher")))
    }

    @Test
    fun `window quality follows data coverage and progress`() {
        val t = 1_789_000_000_000L // Window 는 실제 epoch 범위만 받는다
        val perApp = mapOf("yt" to listOf(Span(t + 50 * MIN, t + 70 * MIN)))
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
    }
}
