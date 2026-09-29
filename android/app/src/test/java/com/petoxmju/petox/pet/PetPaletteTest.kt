package com.petoxmju.petox.pet

import java.io.File
import java.util.Base64
import java.util.zip.Inflater
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.double
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * AI 저장소 pet_template/export_palette.py 가 만든 사례(reference.py 결과)와 같은 값을 내는지 본다.
 * Python 이 정본이다 — 어긋나면 Kotlin 을 고친다.
 */
class PetPaletteTest {
    private val palette = PetPalette.parse(File("src/main/assets/pet_palette.json").readText())
    private val cases = Json.parseToJsonElement(javaClass.getResource("/pet_cases.json")!!.readText()).jsonObject

    private fun JsonObject.str(key: String): String? = this[key]?.takeUnless { it is JsonNull }?.jsonPrimitive?.content

    @Test
    fun `lab matches python`() {
        for (c in cases["labs"]!!.jsonArray) {
            val want = c.jsonObject["lab"]!!.jsonArray.map { it.jsonPrimitive.double }.toDoubleArray()
            assertArrayEquals(c.jsonObject.str("hex"), want, PetPalette.hexToLab(c.jsonObject.str("hex")!!), 1e-9)
        }
        for (c in cases["roundtrip"]!!.jsonArray) {
            val lab = c.jsonObject["lab"]!!.jsonArray.map { it.jsonPrimitive.double }.toDoubleArray()
            assertEquals(lab.joinToString(), c.jsonObject.str("hex"), PetPalette.labToHex(lab))
        }
    }

    @Test
    fun `fit and color map match python for every breed and swatch pair`() {
        for (c in cases["maps"]!!.jsonArray.map { it.jsonObject }) {
            val breed = c.str("breed")!!
            val label = "$breed main=${c.str("main")} sub=${c.str("sub")}"
            val (fitMain, fitSub) = palette.fitToTemplate(breed, c.str("main"), c.str("sub"))
            assertEquals(label, c.str("fitMain"), fitMain)
            assertEquals(label, c.str("fitSub"), fitSub)
            val want = c["map"]!!.jsonObject.entries.associate { it.key.lowercase() to it.value.jsonPrimitive.content }
            assertEquals(label, want, palette.colorMap(breed, fitMain, fitSub))
        }
    }

    @Test
    fun `fur color extraction matches python`() {
        for ((i, c) in cases["extract"]!!.jsonArray.map { it.jsonObject }.withIndex()) {
            val w = c["w"]!!.jsonPrimitive.int
            val h = c["h"]!!.jsonPrimitive.int
            val got = palette.extractColors(argb(c.str("rgba")!!, w, h), w, h)
            assertEquals("case $i ${w}x$h", c.str("main") to c.str("sub"), got)
        }
    }

    /** zlib 으로 압축한 RGBA 바이트 → Android Bitmap 과 같은 ARGB Int 배열. */
    private fun argb(b64: String, w: Int, h: Int): IntArray {
        val bytes = ByteArray(w * h * 4)
        Inflater().run { setInput(Base64.getDecoder().decode(b64)); inflate(bytes); end() }
        return IntArray(w * h) { i ->
            val o = i * 4
            (bytes[o + 3].toInt() and 0xff shl 24) or (bytes[o].toInt() and 0xff shl 16) or
                (bytes[o + 1].toInt() and 0xff shl 8) or (bytes[o + 2].toInt() and 0xff)
        }
    }

    @Test
    fun `recolor replaces only mapped opaque pixels`() {
        val map = mapOf("#112233" to "#aabbcc")
        val px = intArrayOf(0xff112233.toInt(), 0x00112233, 0xff445566.toInt())
        PetPalette.recolor(px, map)
        assertArrayEquals(intArrayOf(0xffaabbcc.toInt(), 0x00112233, 0xff445566.toInt()), px)
    }
}
