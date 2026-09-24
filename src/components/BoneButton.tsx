import React from 'react';
import {
  Image,
  ImageSourcePropType,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { petoxColors, petoxFont } from '@/theme/petox';

const HEIGHT = 64;
const KNOB = 34; // 양 끝 돌기(원) 지름
const BAR_INSET = 12; // 중앙 막대의 위아래 여백
const BORDER = 2;
const DISABLED_GREEN = '#CEE7CD'; // petoxColors.green(#85C482) 40% on white

type Props = {
  text: string;
  onPress: () => void;
  /** outline: 흰 배경 + 초록 테두리 (보조 액션) */
  variant?: 'filled' | 'outline';
  /** 라벨 오른쪽에 붙는 아이콘 */
  icon?: ImageSourcePropType;
  style?: ViewStyle;
  /** true 면 눌리지 않고 흐리게 보입니다 (필수 선택 전 등) */
  disabled?: boolean;
};

/**
 * 뼈다귀 모양 버튼. react-native-svg 의존 없이 View 겹침으로 그립니다.
 * outline 은 초록 도형 위에 살짝 작은 흰 도형을 덮어 테두리처럼 보이게 합니다.
 */
export function BoneButton({
  text,
  onPress,
  variant = 'filled',
  icon,
  style,
  disabled = false,
}: Props) {
  // 비활성은 투명도 대신 "흰 배경 위 40% 초록"과 같은 연한 단색으로 칠한다.
  // 안드로이드는 부모 opacity 를 조각(막대·돌기)마다 따로 먹여서, 겹친 부분이 진하게 보였다.
  const green = disabled ? DISABLED_GREEN : petoxColors.green;
  const shape = (color: string, inset: number) => (
    <>
      <View
        style={[
          styles.bar,
          {
            backgroundColor: color,
            top: BAR_INSET + inset,
            bottom: BAR_INSET + inset,
            left: KNOB / 2 + inset,
            right: KNOB / 2 + inset,
          },
        ]}
      />
      {[
        { left: inset, top: inset },
        { left: inset, bottom: inset },
        { right: inset, top: inset },
        { right: inset, bottom: inset },
      ].map((pos, i) => (
        <View
          key={i}
          style={[
            styles.knob,
            pos,
            {
              backgroundColor: color,
              width: KNOB - inset * 2,
              height: KNOB - inset * 2,
              borderRadius: (KNOB - inset * 2) / 2,
            },
          ]}
        />
      ))}
    </>
  );

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      accessibilityState={{ disabled }}
      // 눌렀을 때 opacity 도 조각별로 먹지 않게 한 장으로 합쳐서 그린다
      needsOffscreenAlphaCompositing
      style={({ pressed }) => [
        styles.container,
        pressed && styles.pressed,
        style,
      ]}>
      {shape(green, 0)}
      {variant === 'outline' && shape(petoxColors.white, BORDER)}
      <View style={styles.labelRow}>
        <Text
          style={[styles.label, variant === 'outline' && styles.labelOutline]}>
          {text}
        </Text>
        {icon !== undefined && (
          <Image source={icon} style={styles.icon} resizeMode="contain" />
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pressed: { opacity: 0.85 },
  bar: { position: 'absolute', borderRadius: 24 },
  knob: { position: 'absolute' },
  labelRow: { flexDirection: 'row', alignItems: 'center' },
  icon: { width: 20, height: 17, marginLeft: 5 },
  label: {
    fontFamily: petoxFont,
    fontSize: 17,
    fontWeight: '600',
    color: petoxColors.white,
  },
  labelOutline: { color: petoxColors.text },
});
