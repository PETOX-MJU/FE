import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeScreen } from '@/screens/HomeScreen';
import { ScreentimeDashboardScreen } from '@/screens/ScreentimeDashboardScreen';
import { MyPageScreen } from '@/screens/MyPageScreen';
import { SplashScreen } from '@/screens/SplashScreen';
import { LoginScreen } from '@/screens/LoginScreen';
import { EmailLoginScreen } from '@/screens/EmailLoginScreen';
import { SignupScreen } from '@/screens/SignupScreen';
import { OnboardingWelcomeScreen } from '@/screens/OnboardingWelcomeScreen';
import { OnboardingGoalScreen } from '@/screens/OnboardingGoalScreen';
import { OnboardingBlockTimeScreen } from '@/screens/OnboardingBlockTimeScreen';
import { OnboardingCustomTimeScreen } from '@/screens/OnboardingCustomTimeScreen';
import { OnboardingCharacterScreen } from '@/screens/OnboardingCharacterScreen';
import { OnboardingPetPhotoScreen } from '@/screens/OnboardingPetPhotoScreen';
import { OnboardingConvertScreen } from '@/screens/OnboardingConvertScreen';
import { OnboardingConfirmScreen } from '@/screens/OnboardingConfirmScreen';
import type { PetId } from '@/constants/onboardingStrings';

export type RootStackParamList = {
  Splash: undefined;
  Login: undefined;
  EmailLogin: undefined;
  Signup: undefined;
  OnboardingWelcome: { nickname?: string } | undefined;
  OnboardingGoal: undefined;
  OnboardingBlockTime: { goalMinutes: number };
  OnboardingCustomTime: { goalMinutes: number };
  OnboardingCharacter: { goalMinutes: number; blockSlots: string[] };
  OnboardingPetPhoto: { goalMinutes: number; blockSlots: string[] };
  OnboardingConvert: { goalMinutes: number; blockSlots: string[] };
  OnboardingConfirm: {
    goalMinutes: number;
    blockSlots: string[];
    /** 기본 캐릭터를 골라서 온 경우 */
    pet?: PetId;
    /** 사진 변환으로 만들어진 캐릭터 이미지 경로 */
    generatedUri?: string;
  };
  Home: undefined;
  ScreentimeDashboard: undefined;
  MyPage: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// 인증 화면은 헤더 없는 전체 화면. Home 은 기존 설정 그대로 둡니다.
const authOptions = { headerShown: false } as const;

export function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Splash"
        screenOptions={{ headerShown: false }}>
        <Stack.Screen
          name="Splash"
          component={SplashScreen}
          options={authOptions}
        />
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={authOptions}
        />
        <Stack.Screen
          name="EmailLogin"
          component={EmailLoginScreen}
          options={authOptions}
        />
        <Stack.Screen
          name="Signup"
          component={SignupScreen}
          options={authOptions}
        />
        <Stack.Screen
          name="OnboardingWelcome"
          component={OnboardingWelcomeScreen}
          options={authOptions}
        />
        <Stack.Screen
          name="OnboardingGoal"
          component={OnboardingGoalScreen}
          options={authOptions}
        />
        <Stack.Screen
          name="OnboardingBlockTime"
          component={OnboardingBlockTimeScreen}
          options={authOptions}
        />
        <Stack.Screen
          name="OnboardingCustomTime"
          component={OnboardingCustomTimeScreen}
          options={authOptions}
        />
        <Stack.Screen
          name="OnboardingCharacter"
          component={OnboardingCharacterScreen}
          options={authOptions}
        />
        <Stack.Screen
          name="OnboardingPetPhoto"
          component={OnboardingPetPhotoScreen}
          options={authOptions}
        />
        <Stack.Screen
          name="OnboardingConvert"
          component={OnboardingConvertScreen}
          options={authOptions}
        />
        <Stack.Screen
          name="OnboardingConfirm"
          component={OnboardingConfirmScreen}
          options={authOptions}
        />
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="ScreentimeDashboard" component={ScreentimeDashboardScreen} />
        <Stack.Screen name="MyPage" component={MyPageScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
