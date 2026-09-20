import React from 'react';
import { Image, StyleSheet } from 'react-native';

// 내보낸 로고 에셋의 고유 비율 (667 x 152, 여백 타이트 크롭)
const LOGO_ASPECT_RATIO = 667 / 152;

type Props = {
  /** 로고 높이(dp). 기본 72 — 스플래시/로그인 기준. */
  height?: number;
};

/** Petox 워드마크. 고양이귀 P + 발바닥 O. */
export function PetoxLogo({ height = 72 }: Props) {
  return (
    <Image
      source={require('../assets/images/petox_logo.png')}
      accessibilityLabel="Petox"
      resizeMode="contain"
      style={[styles.logo, { height, width: height * LOGO_ASPECT_RATIO }]}
    />
  );
}

const styles = StyleSheet.create({
  logo: { alignSelf: 'center' },
});
