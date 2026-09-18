package com.petox.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import com.petox.app.ui.navigation.PetoxNavHost
import com.petox.app.ui.theme.PetoxTheme
import com.petox.app.ui.theme.PetoxWhite

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        setContent {
            PetoxTheme {
                Surface(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(PetoxWhite),
                    color = PetoxWhite,
                ) {
                    PetoxNavHost()
                }
            }
        }
    }
}
