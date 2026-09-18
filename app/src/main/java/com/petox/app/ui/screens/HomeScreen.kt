package com.petox.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.petox.app.R
import com.petox.app.ui.components.PetoxLogo
import com.petox.app.ui.theme.PetoxHint
import com.petox.app.ui.theme.PetoxText
import com.petox.app.ui.theme.PetoxTheme
import com.petox.app.ui.theme.PetoxWhite

/**
 * Temporary placeholder shown after a successful login.
 * Replace with the real pet/detox home once its design is provided.
 */
@Composable
fun HomeScreen(onLogout: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(PetoxWhite)
            .safeDrawingPadding()
            .padding(horizontal = 24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        PetoxLogo(height = 64.dp)
        Spacer(Modifier.height(32.dp))
        Text(
            text = stringResource(R.string.home_welcome),
            color = PetoxText,
            fontSize = 20.sp,
            fontWeight = FontWeight.Bold,
        )
        Spacer(Modifier.height(8.dp))
        Text(
            text = stringResource(R.string.home_placeholder),
            color = PetoxHint,
            fontSize = 15.sp,
        )
        Spacer(Modifier.height(24.dp))
        TextButton(onClick = onLogout) {
            Text(text = stringResource(R.string.home_logout), color = PetoxHint)
        }
    }
}

@Preview(showBackground = true)
@Composable
private fun HomePreview() {
    PetoxTheme { HomeScreen(onLogout = {}) }
}
