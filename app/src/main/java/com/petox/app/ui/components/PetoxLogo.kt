package com.petox.app.ui.components

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.petox.app.R

// Intrinsic aspect ratio of the exported logo asset (667 x 152, tightly cropped).
private const val LOGO_ASPECT_RATIO = 667f / 152f

/** Petox word-mark, rendered from the exported brand logo (res/drawable-nodpi/petox_logo.png). */
@Composable
fun PetoxLogo(
    modifier: Modifier = Modifier,
    height: Dp = 72.dp,
) {
    Image(
        painter = painterResource(R.drawable.petox_logo),
        contentDescription = "Petox",
        contentScale = ContentScale.Fit,
        modifier = modifier
            .height(height)
            .aspectRatio(LOGO_ASPECT_RATIO),
    )
}
