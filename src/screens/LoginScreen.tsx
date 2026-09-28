import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { KakaoButton, PetoxBlackButton } from '@/components/PetoxButtons';
import { AuthHeader } from '@/components/AuthHeader';
import { showDialog } from '@/components/AppDialog';
import { signInWithKakao } from '@/api/auth';
import { petoxStrings } from '@/constants/petoxStrings';
import { petoxColors, petoxLayout } from '@/theme/petox';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

// 들어올 때마다 다른 문구 — 앱을 켤 때는 아무거나, 그다음부턴 순서대로 돌아간다.
let taglineIndex = Math.floor(Math.random() * petoxStrings.loginTaglines.length);
function nextTagline() {
  const lines = petoxStrings.loginTaglines;
  const line = lines[taglineIndex % lines.length];
  taglineIndex += 1;
  return line;
}

export function LoginScreen({ navigation }: Props) {
  const [tagline] = useState(nextTagline);

  // 카카오 로그인 페이지를 브라우저로 연다. 로그인 후 앱으로 돌아오면 RootNavigator 가 이어서 처리한다.
  const onKakaoLogin = async () => {
    try {
      await signInWithKakao();
    } catch (e) {
      showDialog({
        title: '카카오 로그인을 시작하지 못했어요',
        message: e instanceof Error ? e.message : '잠시 후 다시 시도해 주세요.',
      });
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* 로고 + 문구 — 이메일 로그인 화면과 같은 자리 */}
      <AuthHeader text={tagline} />
      <View style={styles.spacer} />

      {/* 하단 액션 버튼. */}
      <KakaoButton text={petoxStrings.loginKakao} onPress={onKakaoLogin} />
      <View style={styles.gap} />
      <PetoxBlackButton
        text={petoxStrings.loginEmail}
        onPress={() => navigation.navigate('EmailLogin')}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: petoxColors.white,
    paddingHorizontal: petoxLayout.screenPadding,
    paddingBottom: 24,
  },
  spacer: { flex: 1 },
  gap: { height: 12 },
});
