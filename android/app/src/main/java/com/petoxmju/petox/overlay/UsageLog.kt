package com.petoxmju.petox.overlay

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.time.LocalDate
import java.time.ZoneId

/**
 * 오버레이가 잰 "하루 두 숫자"를 기기에 날짜(KST)별로 쌓아 둔다 — 서버 미션 판정용 (BE 제안 9/29).
 * - 앱별 숏폼 시청 초: 숏폼 화면으로 판정된 1초마다 +1 (화면 캡처를 거절해 앱 단위로 도는 중이면 그 앱을 본 1초마다)
 * - 펫 등장 횟수: 펫이 처음 나타날(걸어 들어올) 때마다 +1
 * 최근 KEEP_DAYS 일치만 남긴다. 업로드는 JS(features/screentime/sync.ts)가 한다.
 * 저장하는 건 숫자뿐 — 화면·영상 내용은 저장하지 않는다.
 */
object UsageLog {
    private const val PREFS = "petox_usage_log"
    const val KEEP_DAYS = 7
    private val KST: ZoneId = ZoneId.of("Asia/Seoul")

    private fun prefs(ctx: Context) = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun today(): String = LocalDate.now(KST).toString()

    fun addShortsSecond(ctx: Context, pkg: String) {
        val key = "s|${today()}|$pkg"
        val p = prefs(ctx)
        p.edit().putInt(key, p.getInt(key, 0) + 1).apply()
    }

    fun addPetCall(ctx: Context) {
        val key = "p|${today()}"
        val p = prefs(ctx)
        p.edit().putInt(key, p.getInt(key, 0) + 1).apply()
        prune(ctx)
    }

    /** 최근 days 일(오늘 포함, 오래된 날부터). 기록이 없는 날도 0 으로 넣는다. */
    fun dump(ctx: Context, days: Int = KEEP_DAYS): String {
        prune(ctx)
        val all = prefs(ctx).all
        val today = LocalDate.now(KST)
        val out = JSONArray()
        for (i in days - 1 downTo 0) {
            val date = today.minusDays(i.toLong()).toString()
            val apps = JSONObject()
            for ((k, v) in all) {
                if (k.startsWith("s|$date|") && v is Int) apps.put(k.substringAfter("s|$date|"), v)
            }
            out.put(
                JSONObject()
                    .put("date", date)
                    .put("apps", apps)
                    .put("petCalls", (all["p|$date"] as? Int) ?: 0),
            )
        }
        return out.toString()
    }

    private fun prune(ctx: Context) {
        val oldest = LocalDate.now(KST).minusDays((KEEP_DAYS - 1).toLong()).toString()
        val p = prefs(ctx)
        val stale = p.all.keys.filter { key ->
            val date = key.split("|").getOrNull(1) ?: return@filter true
            date < oldest // YYYY-MM-DD 는 문자열 비교 = 날짜 비교
        }
        if (stale.isNotEmpty()) p.edit().apply { stale.forEach { remove(it) } }.apply()
    }
}
