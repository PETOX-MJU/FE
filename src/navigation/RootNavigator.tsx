import React from 'react';
import { AppDialogHost } from '@/components/AppDialog';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeScreen } from '@/screens/HomeScreen';
import { ScreentimeDashboardScreen } from '@/screens/ScreentimeDashboardScreen';
import { MyPageScreen } from '@/screens/MyPageScreen';
import { GoalSettingsScreen } from '@/screens/settings/GoalSettingsScreen';
import { DetectedAppsScreen } from '@/screens/settings/DetectedAppsScreen';
import { BlockTimeSettingsScreen } from '@/screens/settings/BlockTimeSettingsScreen';
import { SplashScreen } from '@/screens/SplashScreen';
import { LoginScreen } from '@/screens/LoginScreen';
import { EmailLoginScreen } from '@/screens/EmailLoginScreen';
import { SignupScreen } from '@/screens/SignupScreen';
import { EmailConfirmWaitScreen } from '@/screens/EmailConfirmWaitScreen';
import { OnboardingWelcomeScreen } from '@/screens/OnboardingWelcomeScreen';
import { OnboardingGoalScreen } from '@/screens/OnboardingGoalScreen';
import { OnboardingBlockTimeScreen } from '@/screens/OnboardingBlockTimeScreen';
import { OnboardingCustomTimeScreen } from '@/screens/OnboardingCustomTimeScreen';
import { OnboardingAppsScreen } from '@/screens/OnboardingAppsScreen';
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
  /** 가입 후 인증 메일을 기다리는 화면 */
  EmailConfirmWait: { email: string; nickname: string };
  OnboardingWelcome: { nickname?: string } | undefined;
  OnboardingGoal: undefined;
  /** addSlot: 직접 설정 화면에서 고른 구간을 돌려받는다 */
  /** replaceSlot: 수정한 경우 원래 구간 (빼고 addSlot 을 넣는다) */
  OnboardingBlockTime: {
    goalMinutes: number;
    addSlot?: string;
    replaceSlot?: string;
  };
  /** 온보딩(goalMinutes) 또는 마이페이지 시간대 설정(fromSettings)에서 연다 */
  OnboardingCustomTime: {
    goalMinutes?: number;
    fromSettings?: boolean;
    /** 이미 고른 시간대 (타임라인에 옅게 표시하고 겹치면 알려 준다) */
    existing?: string[];
    /** 직접 설정한 구간을 고칠 때 원래 값 ("HH:00~HH:00") */
    edit?: string;
  };
  OnboardingApps: { goalMinutes: number; blockSlots: string[] };
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
  GoalSettings: undefined;
  DetectedApps: undefined;
  /** addSlot: 직접 추가 화면에서 고른 구간("HH:00~HH:00")을 돌려받는다 */
  BlockTimeSettings: { addSlot?: string; replaceSlot?: string } | undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// 인증 화면은 헤더 없는 전체 화면. Home 은 기존 설정 그대로 둡니다.
const authOptions = { headerShown: false } as const;

export function RootNavigator() {
  return (
    <>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="Splash"
          screenOptions={{ headerShown: false }}
        >
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
            name="EmailConfirmWait"
            component={EmailConfirmWaitScreen}
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
            name="OnboardingApps"
            component={OnboardingAppsScreen}
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
          <Stack.Screen
            name="ScreentimeDashboard"
            component={ScreentimeDashboardScreen}
          />
          <Stack.Screen name="MyPage" component={MyPageScreen} />
          <Stack.Screen name="GoalSettings" component={GoalSettingsScreen} />
          <Stack.Screen name="DetectedApps" component={DetectedAppsScreen} />
          <Stack.Screen
            name="BlockTimeSettings"
            component={BlockTimeSettingsScreen}
          />
        </Stack.Navigator>
      </NavigationContainer>
      {/* 앱 스타일 알림창 (showDialog) — 화면 전환과 상관없이 맨 위에 뜬다 */}
      <AppDialogHost />
    </>
  );
}
