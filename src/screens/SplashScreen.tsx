import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PetoxLogo } from '@/components/PetoxLogo';
import { hasSession, routeAfterLogin } from '@/api/auth';
import { petoxColors } from '@/theme/petox';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Splash'>;

const SPLASH_DURATION_MS = 1500;

export function SplashScreen({ navigation }: Props) {
  useEffect(() => {
    let cancelled = false;
    // 로고를 최소 SPLASH_DURATION_MS 동안 보여주면서, 그사이 저장된 로그인 세션을 확인한다.
    // 세션이 있으면(자동 로그인) 로그인 화면을 건너뛴다.
    const wait = new Promise<void>(resolve => {
      setTimeout(() => resolve(), SPLASH_DURATION_MS);
    });
    (async () => {
      let next: 'Login' | 'Home' | 'OnboardingWelcome' = 'Login';
      try {
        if (await hasSession()) next = await routeAfterLogin();
      } catch {
        next = 'Login';
      }
      await wait;
      if (!cancelled) navigation.reset({ index: 0, routes: [{ name: next }] });
    })();
    return () => {
      cancelled = true;
    };
  }, [navigation]);

  return (
    <View style={styles.container}>
      <PetoxLogo />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: petoxColors.white,
  },
});
