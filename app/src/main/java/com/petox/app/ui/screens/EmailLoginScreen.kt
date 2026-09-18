package com.petox.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.petox.app.R
import com.petox.app.ui.components.PetoxBlackButton
import com.petox.app.ui.components.PetoxLogo
import com.petox.app.ui.components.PetoxTextField
import com.petox.app.ui.theme.PetoxGreenDark
import com.petox.app.ui.theme.PetoxHint
import com.petox.app.ui.theme.PetoxTheme
import com.petox.app.ui.theme.PetoxWhite

private val EMAIL_REGEX = Regex("^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$")

@Composable
fun EmailLoginScreen(
    onLoginSuccess: () -> Unit,
    onGoToSignup: () -> Unit,
) {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }

    val emailError = stringResource(R.string.email_login_error_email)
    val passwordError = stringResource(R.string.email_login_error_password)

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(PetoxWhite)
            .safeDrawingPadding()
            .imePadding()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Spacer(Modifier.height(80.dp))
        PetoxLogo(height = 60.dp)

        Spacer(Modifier.height(56.dp))
        PetoxTextField(
            value = email,
            onValueChange = { email = it; error = null },
            hint = stringResource(R.string.email_login_email_hint),
            keyboardType = KeyboardType.Email,
        )
        Spacer(Modifier.height(28.dp))
        PetoxTextField(
            value = password,
            onValueChange = { password = it; error = null },
            hint = stringResource(R.string.email_login_password_hint),
            keyboardType = KeyboardType.Password,
            isPassword = true,
        )

        if (error != null) {
            Spacer(Modifier.height(12.dp))
            Text(
                text = error!!,
                color = PetoxGreenDark,
                fontSize = 13.sp,
                modifier = Modifier.align(Alignment.Start),
            )
        }

        Spacer(Modifier.height(40.dp))
        PetoxBlackButton(
            text = stringResource(R.string.email_login_submit),
            onClick = {
                when {
                    !EMAIL_REGEX.matches(email.trim()) -> error = emailError
                    password.isEmpty() -> error = passwordError
                    else -> {
                        // TODO: 백엔드 연동 지점 — 실제 인증 API 호출 후 성공 시 이동.
                        // 지금은 클라이언트 유효성 검사만 통과하면 로그인 성공 처리.
                        onLoginSuccess()
                    }
                }
            },
        )

        Spacer(Modifier.height(20.dp))
        Text(
            text = stringResource(R.string.email_login_to_signup),
            color = PetoxHint,
            fontSize = 14.sp,
            modifier = Modifier.clickable { onGoToSignup() },
        )
        Spacer(Modifier.height(24.dp))
    }
}

@Preview(showBackground = true)
@Composable
private fun EmailLoginPreview() {
    PetoxTheme { EmailLoginScreen(onLoginSuccess = {}, onGoToSignup = {}) }
}
