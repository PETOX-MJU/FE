import React from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { PetoxLogo } from '@/components/PetoxLogo';
import { petoxColors, petoxTextBase } from '@/theme/petox';

// 로그인 첫 화면 ↔ 이메일 로그인 화면이 같은 로고 크기·위치·문구 간격을 쓰도록 묶었다.
// 화면을 넘어가도 로고가 제자리에 있고 밑의 문구만 바뀐다.

export const AUTH_LOGO_HEIGHT = 72;
// 안전 영역 아래 ~ 로고 윗변 = 화면 높이의 25% (예전 로그인 첫 화면의 위쪽 1/3 쯤 자리)
const TOP_RATIO = 0.25;

export function AuthHeader({ text }: { text: string }) {
  const { height } = useWindowDimensions();
  return (
    <View style={[styles.wrap, { marginTop: Math.round(height * TOP_RATIO) }]}>
      <PetoxLogo height={AUTH_LOGO_HEIGHT} />
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', alignSelf: 'stretch' },
  text: {
    ...petoxTextBase,
    marginTop: 16,
    fontSize: 16,
    color: petoxColors.hint,
    textAlign: 'center',
  },
});
