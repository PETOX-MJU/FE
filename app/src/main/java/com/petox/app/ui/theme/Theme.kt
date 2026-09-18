package com.petox.app.ui.theme

import android.app.Activity
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

private val PetoxColorScheme = lightColorScheme(
    primary = PetoxGreen,
    onPrimary = PetoxWhite,
    primaryContainer = PetoxGreenLight,
    onPrimaryContainer = PetoxGreenDark,
    secondary = PetoxBlack,
    onSecondary = PetoxWhite,
    background = PetoxWhite,
    onBackground = PetoxText,
    surface = PetoxWhite,
    onSurface = PetoxText,
    outline = PetoxLine,
)

@Composable
fun PetoxTheme(
    // The design is a single light theme; keep it consistent regardless of system setting.
    darkTheme: Boolean = false,
    content: @Composable () -> Unit,
) {
    val colorScheme = PetoxColorScheme

    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            // White background => dark (light-appearance) status bar & nav bar icons.
            val controller = WindowCompat.getInsetsController(window, view)
            controller.isAppearanceLightStatusBars = true
            controller.isAppearanceLightNavigationBars = true
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = PetoxTypography,
        content = content,
    )
}
