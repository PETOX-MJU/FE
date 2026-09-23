import React from 'react';
import { Image, Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import { petoxColors, petoxFont, petoxLayout } from '@/theme/petox';

type ButtonProps = {
  text: string;
  onPress: () => void;
  style?: ViewStyle;
  /** true 면 눌리지 않고 흐리게 보입니다 (요청 중 등) */
  disabled?: boolean;
};

/** 말풍선 아이콘이 붙은 카카오 노란 로그인 버튼. */
export function KakaoButton({ text, onPress, style }: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        styles.kakao,
        pressed && styles.pressed,
        style,
      ]}>
      <Image
        source={require('../assets/images/kakao_logo.png')}
        style={styles.kakaoIcon}
        resizeMode="contain"
      />
      <Text style={styles.kakaoLabel}>{text}</Text>
    </Pressable>
  );
}

/** 검정 단색 기본 액션 버튼. */
export function PetoxBlackButton({
  text,
  onPress,
  style,
  disabled = false,
}: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.base,
        styles.black,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}>
      <Text style={styles.blackLabel}>{text}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: '100%',
    height: petoxLayout.buttonHeight,
    borderRadius: petoxLayout.buttonRadius,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },
  kakao: { backgroundColor: petoxColors.kakaoYellow },
  kakaoIcon: { width: 20, height: 20, marginRight: 8 },
  kakaoLabel: {
    color: petoxColors.kakaoLabel,
    fontSize: 18,
    fontFamily: petoxFont,
    fontWeight: '600',
  },
  black: { backgroundColor: petoxColors.black },
  blackLabel: {
    color: petoxColors.white,
    fontSize: 18,
    fontFamily: petoxFont,
    fontWeight: '600',
  },
});
