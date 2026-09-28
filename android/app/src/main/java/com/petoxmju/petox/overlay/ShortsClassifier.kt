package com.petoxmju.petox.overlay

import android.content.Context
import android.graphics.Bitmap
import android.media.Image
import org.tensorflow.lite.DataType
import org.tensorflow.lite.Interpreter
import java.io.Closeable
import java.nio.ByteBuffer
import java.nio.ByteOrder

/**
 * AI 저장소 shorts_classifier 의 TFLite 모델 — 화면 한 장을 보고 "숏폼 화면일 점수(0~1)"를 낸다.
 * (AI/shorts_classifier/README 「앱 연동 메모」)
 * - 입력 [1, H, W, 3] RGB 0~255 (전처리는 모델 안에 있다). 크기는 모델 입력 텐서에서 읽는다 (기본 448 × 224).
 * - 세로 화면을 가운데 자르기 없이 그 크기로 늘려서 넣는다 (학습이 그렇게 했다).
 * - 출력: 0~1 한 개. 판정(최근 N장 평균 ≥ 임계값)은 OverlayService 가 한다.
 * 프레임은 메모리에서만 쓰고 바로 버린다 — 저장·전송하지 않는다.
 */
class ShortsClassifier(context: Context) : Closeable {

    companion object {
        const val MODEL_ASSET = "shorts_classifier.tflite"
    }

    private val interpreter: Interpreter
    private val inputW: Int
    private val inputH: Int
    private val inputType: DataType
    private val input: ByteBuffer
    private val pixels: IntArray

    init {
        // 에셋을 통째로 direct 버퍼에 올린다 (압축 여부와 상관없이 동작)
        val bytes = context.assets.open(MODEL_ASSET).use { it.readBytes() }
        val model = ByteBuffer.allocateDirect(bytes.size).order(ByteOrder.nativeOrder())
        model.put(bytes)
        model.rewind()
        interpreter = Interpreter(model, Interpreter.Options().setNumThreads(2))

        val tensor = interpreter.getInputTensor(0)
        val shape = tensor.shape() // [1, H, W, 3]
        inputH = shape[1]
        inputW = shape[2]
        inputType = tensor.dataType()
        val bytesPerValue = if (inputType == DataType.FLOAT32) 4 else 1
        input = ByteBuffer.allocateDirect(inputH * inputW * 3 * bytesPerValue).order(ByteOrder.nativeOrder())
        pixels = IntArray(inputW * inputH)
    }

    val inputSize: String get() = "${inputH}x$inputW ($inputType)"

    /** 화면 한 장의 숏폼 점수 (0~1) */
    fun score(frame: Bitmap): Float {
        val scaled = Bitmap.createScaledBitmap(frame, inputW, inputH, true)
        scaled.getPixels(pixels, 0, inputW, 0, 0, inputW, inputH)
        if (scaled !== frame) scaled.recycle()

        input.rewind()
        for (p in pixels) {
            val r = (p shr 16) and 0xFF
            val g = (p shr 8) and 0xFF
            val b = p and 0xFF
            if (inputType == DataType.FLOAT32) {
                input.putFloat(r.toFloat())
                input.putFloat(g.toFloat())
                input.putFloat(b.toFloat())
            } else {
                input.put(r.toByte())
                input.put(g.toByte())
                input.put(b.toByte())
            }
        }
        input.rewind()

        val outTensor = interpreter.getOutputTensor(0)
        val out = ByteBuffer.allocateDirect(outTensor.numBytes()).order(ByteOrder.nativeOrder())
        interpreter.run(input, out)
        out.rewind()
        return when (outTensor.dataType()) {
            DataType.FLOAT32 -> out.float
            else -> {
                // 양자화 출력이면 되돌린다
                val q = outTensor.quantizationParams()
                val raw = out.get().toInt() and 0xFF
                (raw - q.zeroPoint) * q.scale
            }
        }
    }

    override fun close() {
        interpreter.close()
    }
}

/** ImageReader(RGBA_8888) 한 장 → Bitmap. 줄 끝 여백(rowStride)을 잘라 낸다. */
fun Image.toBitmap(): Bitmap {
    val plane = planes[0]
    val pixelStride = plane.pixelStride
    val rowPadding = plane.rowStride - pixelStride * width
    val padded = Bitmap.createBitmap(width + rowPadding / pixelStride, height, Bitmap.Config.ARGB_8888)
    padded.copyPixelsFromBuffer(plane.buffer)
    if (rowPadding == 0) return padded
    val cropped = Bitmap.createBitmap(padded, 0, 0, width, height)
    padded.recycle()
    return cropped
}
