package com.petox.app.ui.navigation

import androidx.compose.runtime.Composable
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.petox.app.ui.screens.EmailLoginScreen
import com.petox.app.ui.screens.HomeScreen
import com.petox.app.ui.screens.LoginScreen
import com.petox.app.ui.screens.SignupScreen
import com.petox.app.ui.screens.SplashScreen

object Routes {
    const val SPLASH = "splash"
    const val LOGIN = "login"
    const val EMAIL_LOGIN = "email_login"
    const val SIGNUP = "signup"
    const val HOME = "home"
}

@Composable
fun PetoxNavHost(
    navController: NavHostController = rememberNavController(),
) {
    NavHost(navController = navController, startDestination = Routes.SPLASH) {
        composable(Routes.SPLASH) {
            SplashScreen(
                onTimeout = {
                    navController.navigate(Routes.LOGIN) {
                        popUpTo(Routes.SPLASH) { inclusive = true }
                    }
                },
            )
        }
        composable(Routes.LOGIN) {
            LoginScreen(
                onKakaoLogin = { /* TODO: Kakao SDK 연동 예정 */ },
                onEmailLogin = { navController.navigate(Routes.EMAIL_LOGIN) },
            )
        }
        composable(Routes.EMAIL_LOGIN) {
            EmailLoginScreen(
                onLoginSuccess = {
                    navController.navigate(Routes.HOME) {
                        // 로그인 후에는 인증 화면들을 백스택에서 제거.
                        popUpTo(Routes.LOGIN) { inclusive = true }
                    }
                },
                onGoToSignup = { navController.navigate(Routes.SIGNUP) },
            )
        }
        composable(Routes.SIGNUP) {
            SignupScreen(
                onSubmit = { _, _, _ ->
                    // TODO: 백엔드 연동 지점 — 회원가입 API 성공 시 이동.
                    navController.navigate(Routes.HOME) {
                        popUpTo(Routes.LOGIN) { inclusive = true }
                    }
                },
                onBack = { navController.popBackStack() },
            )
        }
        composable(Routes.HOME) {
            HomeScreen(
                onLogout = {
                    navController.navigate(Routes.LOGIN) {
                        popUpTo(Routes.HOME) { inclusive = true }
                    }
                },
            )
        }
    }
}
