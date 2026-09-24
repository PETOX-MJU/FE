import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { KakaoButton, PetoxBlackButton } from '@/components/PetoxButtons';
import { PetoxLogo } from '@/components/PetoxLogo';
import { petoxStrings } from '@/constants/petoxStrings';
import { petoxColors, petoxFont, petoxLayout } from '@/theme/petox';
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

  const onKakaoLogin = () => {
    // TODO: 백엔드 연동 지점 — 카카오 SDK 연동 예정.
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* 로고 + 태그라인 블록을 화면 위쪽 1/3 지점으로. */}
      <View style={styles.spacerTop} />
      <PetoxLogo />
      <Text style={styles.tagline}>{tagline}</Text>
      <View style={styles.spacerBottom} />

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
  spacerTop: { flex: 0.9 },
  spacerBottom: { flex: 1.4 },
  tagline: {
    marginTop: 14,
    color: petoxColors.hint,
    fontFamily: petoxFont,
    fontSize: 16,
  },
  gap: { height: 12 },
});
