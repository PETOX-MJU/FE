package com.petox.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import com.petox.app.ui.components.PetoxLogo
import com.petox.app.ui.theme.PetoxTheme
import com.petox.app.ui.theme.PetoxWhite
import kotlinx.coroutines.delay

@Composable
fun SplashScreen(onTimeout: () -> Unit) {
    val currentOnTimeout by rememberUpdatedState(onTimeout)
    LaunchedEffect(Unit) {
        delay(1500)
        currentOnTimeout()
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(PetoxWhite),
        contentAlignment = Alignment.Center,
    ) {
        PetoxLogo()
    }
}

@Preview(showBackground = true)
@Composable
private fun SplashPreview() {
    PetoxTheme { SplashScreen(onTimeout = {}) }
}
