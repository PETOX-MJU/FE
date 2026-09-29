package com.petoxmju.petox.pet

import kotlin.math.cbrt
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.sqrt
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.double
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

/**
 * 사진 털색 추출과 견종 템플릿 색 치환표. 안드로이드 의존이 없는 순수 계산이다.
 *
 * 정본은 AI 저장소 pet_template/reference.py 다 (extract_colors, fit_to_template, color_map).
 * 데이터(pet_palette.json)와 대조 사례(test/resources/pet_cases.json)는 거기의 export_palette.py 가 만든다.
 * 규칙을 바꿀 때는 Python 을 먼저 고치고 두 파일을 다시 복사한다.
 */
class PetPalette(
    /** 스와치 이름 → hex. 순서가 동점 처리 순서다 (Python dict 순서와 같다). */
    val swatches: Map<String, String>,
    private val subRatio: Double,
    private val chromaKeep: Double,
    private val minFurL: Double,
    private val breeds: Map<String, Breed>,
) {
    /** roles: 에셋 hex → main/sub/keep. base: 역할별 기준색(AI 에셋 전체에서 픽셀 수 최다). */
    class Breed(val roles: Map<String, String>, val base: Map<String, String?>)

    /**
     * 배경을 지운 사진(ARGB, 비프리멀티플라이) → (main 스와치 이름, sub 스와치 이름).
     * 불투명(알파 > 128) 픽셀이 없으면 (null, null) — 호출 측은 원본색으로 간다.
     */
    fun extractColors(argb: IntArray, width: Int, height: Int): Pair<String?, String?> {
        val names = swatches.keys.toList()
        val swatchLabs = names.map { hexToLab(swatches.getValue(it)) }
        val area = IntArray(names.size)
        var fur = 0
        // 축소 대신 일정 간격으로 건너뛴다 (numpy arr[::s, ::s] 와 같은 픽셀)
        val s = max(1, max(width, height) / 256)
        for (y in 0 until height step s) {
            for (x in 0 until width step s) {
                val p = argb[y * width + x]
                if ((p ushr 24) <= 128) continue
                val lab = rgbToLab(((p shr 16) and 0xff) / 255.0, ((p shr 8) and 0xff) / 255.0, (p and 0xff) / 255.0)
                var best = 0
                var bestDist = Double.MAX_VALUE
                for ((i, sl) in swatchLabs.withIndex()) {
                    val d = sqrt((lab[0] - sl[0]).pow(2) + (lab[1] - sl[1]).pow(2) + (lab[2] - sl[2]).pow(2))
                    if (d < bestDist) { bestDist = d; best = i } // 동점이면 앞 스와치 (np.argmin)
                }
                area[best]++
                fur++
            }
        }
        if (fur == 0) return null to null
        // 면적 내림차순, 동점이면 스와치 순서 (Counter.most_common 의 안정 정렬)
        val ranked = names.indices.filter { area[it] > 0 }.sortedByDescending { area[it] }
        val main = names[ranked[0]]
        val sub = ranked.getOrNull(1)?.takeIf { area[it].toDouble() / fur >= subRatio }?.let { names[it] }
        return main to sub
    }

    /**
     * 사진의 (main hex, sub hex) 밝기 순서가 템플릿과 반대면 맞바꾼다 (흰 허스키 사진 등).
     * 사용자가 스와치를 직접 고른 경우에는 부르지 않는다 — 사용자 선택을 뒤집으면 안 된다.
     */
    fun fitToTemplate(breed: String, main: String?, sub: String?): Pair<String?, String?> {
        if (main == null || sub == null) return main to sub
        val base = breeds.getValue(breed).base
        val baseMain = base["main"] ?: return main to sub
        val baseSub = base["sub"] ?: return main to sub
        val order = (hexToLab(baseMain)[0] - hexToLab(baseSub)[0]) * (hexToLab(main)[0] - hexToLab(sub)[0])
        return if (order < 0) sub to main else main to sub
    }

    /**
     * 목표색(hex, 없으면 원본 유지) → {에셋 hex: 새 hex}.
     * 역할의 기준색이 목표색이 되도록 역할 전체를 Lab 에서 옮긴다. 명암 단계는 유지하되
     * [minFurL, 100] 에 들어가게 비율로 줄이고, 색조 편차는 chromaKeep 배만 남긴다.
     */
    fun colorMap(breed: String, main: String?, sub: String?): Map<String, String> {
        val b = breeds.getValue(breed)
        val out = LinkedHashMap<String, String>()
        for ((role, target) in listOf("main" to main, "sub" to sub)) {
            val colors = b.roles.filterValues { it == role }.keys
            val baseHex = b.base[role]
            if (target == null || colors.isEmpty() || baseHex == null) continue
            val base = hexToLab(baseHex)
            val goal = hexToLab(target)
            goal[0] = max(goal[0], minFurL)
            val baseChroma = hypot(base[1], base[2])
            val goalChroma = hypot(goal[1], goal[2])
            val keep = if (baseChroma == 0.0) chromaKeep else chromaKeep * min(1.0, goalChroma / baseChroma)
            val deltas = colors.associateWith { h -> hexToLab(h).let { doubleArrayOf(it[0] - base[0], it[1] - base[1], it[2] - base[2]) } }
            val darkest = deltas.values.minOf { it[0] }
            val brightest = deltas.values.maxOf { it[0] }
            val squeezeDark = if (darkest < 0) min(1.0, max(0.0, goal[0] - minFurL) / -darkest) else 1.0
            val squeezeBright = if (brightest > 0) min(1.0, max(0.0, 100 - goal[0]) / brightest) else 1.0
            for ((h, d) in deltas) {
                val dl = d[0] * (if (d[0] < 0) squeezeDark else squeezeBright)
                out[h] = labToHex(doubleArrayOf(goal[0] + dl, goal[1] + d[1] * keep, goal[2] + d[2] * keep))
            }
        }
        return out
    }

    companion object {
        // sRGB(D65) ↔ CIE Lab. 역행렬은 계산하지 않고 Python(np.linalg.inv) 값을 그대로 쓴다 — 반올림까지 맞추려고.
        private val M = arrayOf(
            doubleArrayOf(0.4124564, 0.3575761, 0.1804375),
            doubleArrayOf(0.2126729, 0.7151522, 0.0721750),
            doubleArrayOf(0.0193339, 0.1191920, 0.9503041),
        )
        private val M_INV = arrayOf(
            doubleArrayOf(3.2404548360214087, -1.5371388501025751, -0.4985315468684809),
            doubleArrayOf(-0.9692663898756538, 1.876010928842491, 0.04155608234667354),
            doubleArrayOf(0.05564341960421366, -0.20402585426769815, 1.0572251624579287),
        )
        private val WHITE = doubleArrayOf(0.95047, 1.0, 1.08883)
        private const val E = 6.0 / 29

        fun parse(json: String): PetPalette {
            val o = Json.parseToJsonElement(json).jsonObject
            fun str(e: kotlinx.serialization.json.JsonElement?) = e?.takeUnless { it is JsonNull }?.jsonPrimitive?.content
            return PetPalette(
                swatches = o.getValue("swatches").jsonObject.mapValues { it.value.jsonPrimitive.content },
                subRatio = o.getValue("subRatio").jsonPrimitive.double,
                chromaKeep = o.getValue("chromaKeep").jsonPrimitive.double,
                minFurL = o.getValue("minFurL").jsonPrimitive.double,
                breeds = o.getValue("breeds").jsonObject.mapValues { (_, v) ->
                    val b = v.jsonObject
                    Breed(
                        roles = b.getValue("roles").jsonObject.mapValues { it.value.jsonPrimitive.content },
                        base = b.getValue("base").jsonObject.mapValues { str(it.value) },
                    )
                },
            )
        }

        /** 색 치환표를 ARGB 픽셀에 적용한다 (제자리). 투명 픽셀은 건드리지 않는다. */
        fun recolor(argb: IntArray, map: Map<String, String>) {
            val table = map.entries.associate { (k, v) -> rgbOf(k) to rgbOf(v) }
            for (i in argb.indices) {
                val p = argb[i]
                if (p ushr 24 == 0) continue
                val dst = table[p and 0xffffff] ?: continue
                argb[i] = (p and 0xff000000.toInt()) or dst
            }
        }

        private fun rgbOf(hex: String) = hex.substring(1).toInt(16)

        fun hexToLab(hex: String): DoubleArray {
            val v = rgbOf(hex)
            return rgbToLab(((v shr 16) and 0xff) / 255.0, ((v shr 8) and 0xff) / 255.0, (v and 0xff) / 255.0)
        }

        fun rgbToLab(r: Double, g: Double, b: Double): DoubleArray {
            val lin = doubleArrayOf(r, g, b).map { if (it <= 0.04045) it / 12.92 else ((it + 0.055) / 1.055).pow(2.4) }
            val f = DoubleArray(3) { i ->
                val xyz = (M[i][0] * lin[0] + M[i][1] * lin[1] + M[i][2] * lin[2]) / WHITE[i]
                if (xyz > E.pow(3)) cbrt(xyz) else xyz / (3 * E.pow(2)) + 4.0 / 29
            }
            return doubleArrayOf(116 * f[1] - 16, 500 * (f[0] - f[1]), 200 * (f[1] - f[2]))
        }

        /** Lab → hex. sRGB 밖으로 나가는 색은 잘라낸다. 반올림은 numpy 와 같은 half-to-even. */
        fun labToHex(lab: DoubleArray): String {
            val fy = (lab[0] + 16) / 116
            val f = doubleArrayOf(fy + lab[1] / 500, fy, fy - lab[2] / 200)
            val xyz = DoubleArray(3) { i -> (if (f[i] > E) f[i].pow(3) else 3 * E.pow(2) * (f[i] - 4.0 / 29)) * WHITE[i] }
            val rgb = IntArray(3) { i ->
                val lin = (M_INV[i][0] * xyz[0] + M_INV[i][1] * xyz[1] + M_INV[i][2] * xyz[2]).coerceIn(0.0, 1.0)
                val s = if (lin <= 0.0031308) lin * 12.92 else 1.055 * lin.pow(1 / 2.4) - 0.055
                Math.rint(s * 255).toInt()
            }
            return "#%02x%02x%02x".format(rgb[0], rgb[1], rgb[2])
        }
    }
}
