package com.petox.app.ui.screens

import androidx.compose.foundation.background
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
import com.petox.app.ui.theme.PetoxHint
import com.petox.app.ui.theme.PetoxTheme
import com.petox.app.ui.theme.PetoxWhite

@Composable
fun SignupScreen(
    onSubmit: (nickname: String, email: String, password: String) -> Unit,
    onBack: () -> Unit,
) {
    var nickname by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }

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
        Spacer(Modifier.height(64.dp))
        PetoxLogo(height = 56.dp)
        Spacer(Modifier.height(12.dp))
        Text(
            text = stringResource(R.string.signup_subtitle),
            color = PetoxHint,
            fontSize = 14.sp,
        )

        Spacer(Modifier.height(48.dp))
        PetoxTextField(
            value = nickname,
            onValueChange = { nickname = it },
            hint = stringResource(R.string.signup_nickname_hint),
        )
        Spacer(Modifier.height(28.dp))
        PetoxTextField(
            value = email,
            onValueChange = { email = it },
            hint = stringResource(R.string.signup_email_hint),
            keyboardType = KeyboardType.Email,
        )
        Spacer(Modifier.height(28.dp))
        PetoxTextField(
            value = password,
            onValueChange = { password = it },
            hint = stringResource(R.string.signup_password_hint),
            keyboardType = KeyboardType.Password,
            isPassword = true,
        )

        Spacer(Modifier.height(48.dp))
        PetoxBlackButton(
            text = stringResource(R.string.signup_submit),
            onClick = { onSubmit(nickname, email, password) },
        )
        Spacer(Modifier.height(24.dp))
    }
}

@Preview(showBackground = true)
@Composable
private fun SignupPreview() {
    PetoxTheme { SignupScreen(onSubmit = { _, _, _ -> }, onBack = {}) }
}
