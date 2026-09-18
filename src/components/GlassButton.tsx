import React from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  type ImageSourcePropType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { GlassSurface } from '@/components/GlassSurface';
import { colors } from '@/theme/colors';

type Props = {
  icon: ImageSourcePropType;
  iconWidth: number;
  iconHeight: number;
  size?: number;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

// 하단 원형 유리 버튼 (리포트 68 / 홈 96 / 캐릭터 68)
export function GlassButton({
  icon,
  iconWidth,
  iconHeight,
  size = 68,
  onPress,
  style,
  accessibilityLabel,
}: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        { width: size, height: size },
        pressed && styles.pressed,
        style,
      ]}
    >
      <GlassSurface
        radius={size / 2}
        tint={colors.glassTintBlue}
        shadow
        style={StyleSheet.absoluteFill}
      >
        <Image source={icon} style={{ width: iconWidth, height: iconHeight }} />
      </GlassSurface>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // 상단 보관함·상점 버튼과 같은 누름 효과 (살짝 흐려지기)
  pressed: {
    opacity: 0.6,
  },
});
