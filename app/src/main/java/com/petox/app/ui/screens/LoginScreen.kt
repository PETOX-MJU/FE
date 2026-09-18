package com.petox.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.petox.app.R
import com.petox.app.ui.components.KakaoButton
import com.petox.app.ui.components.PetoxBlackButton
import com.petox.app.ui.components.PetoxLogo
import com.petox.app.ui.theme.MemomentKkukkukk
import com.petox.app.ui.theme.PetoxHint
import com.petox.app.ui.theme.PetoxTheme
import com.petox.app.ui.theme.PetoxWhite

@Composable
fun LoginScreen(
    onKakaoLogin: () -> Unit,
    onEmailLogin: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(PetoxWhite)
            .safeDrawingPadding()
            .padding(horizontal = 24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        // Logo + tagline block, pushed toward the upper third.
        Spacer(Modifier.weight(0.9f))
        PetoxLogo()
        Spacer(Modifier.height(12.dp))
        Text(
            text = stringResource(R.string.login_tagline),
            color = PetoxHint,
            fontFamily = MemomentKkukkukk,
            fontSize = 18.sp,
        )
        Spacer(Modifier.weight(1.4f))

        // Bottom action buttons.
        KakaoButton(
            text = stringResource(R.string.login_kakao),
            onClick = onKakaoLogin,
        )
        Spacer(Modifier.height(12.dp))
        PetoxBlackButton(
            text = stringResource(R.string.login_email),
            onClick = onEmailLogin,
            fontFamily = MemomentKkukkukk,
        )
        Spacer(Modifier.height(24.dp))
    }
}

@Preview(showBackground = true)
@Composable
private fun LoginPreview() {
    PetoxTheme { LoginScreen(onKakaoLogin = {}, onEmailLogin = {}) }
}
