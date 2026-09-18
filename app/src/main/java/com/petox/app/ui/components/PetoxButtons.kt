package com.petox.app.ui.components

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.petox.app.R
import com.petox.app.ui.theme.KakaoLabel
import com.petox.app.ui.theme.KakaoYellow
import com.petox.app.ui.theme.MemomentKkukkukk
import com.petox.app.ui.theme.PetoxBlack
import com.petox.app.ui.theme.PetoxWhite

private val ButtonShape = RoundedCornerShape(12.dp)
private val ButtonHeight = 52.dp

/** Yellow Kakao login button with a speech-bubble glyph. */
@Composable
fun KakaoButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Button(
        onClick = onClick,
        modifier = modifier.fillMaxWidth().height(ButtonHeight),
        shape = ButtonShape,
        colors = ButtonDefaults.buttonColors(
            containerColor = KakaoYellow,
            contentColor = KakaoLabel,
        ),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center,
        ) {
            Image(
                painter = painterResource(R.drawable.kakao_logo),
                contentDescription = null,
                modifier = Modifier.size(20.dp),
            )
            Spacer(Modifier.width(8.dp))
            Text(
                text = text,
                fontSize = 18.sp,
                fontFamily = MemomentKkukkukk,
                fontWeight = FontWeight.SemiBold,
            )
        }
    }
}

/** Solid black primary/secondary action button. */
@Composable
fun PetoxBlackButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    fontFamily: FontFamily? = null,
) {
    Button(
        onClick = onClick,
        modifier = modifier.fillMaxWidth().height(ButtonHeight),
        shape = ButtonShape,
        colors = ButtonDefaults.buttonColors(
            containerColor = PetoxBlack,
            contentColor = PetoxWhite,
        ),
    ) {
        Text(
            text = text,
            fontSize = if (fontFamily != null) 18.sp else 16.sp,
            fontFamily = fontFamily,
            fontWeight = FontWeight.SemiBold,
        )
    }
}
