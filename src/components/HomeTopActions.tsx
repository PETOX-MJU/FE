import React from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { GlassSurface } from '@/components/GlassSurface';
import { homeImages } from '@/assets/images';
import { colors } from '@/theme/colors';

type Props = {
  onPressStorage?: () => void;
  onPressShop?: () => void;
};

// 상단 오른쪽 보관함 | 상점 pill (피그마 115 × 50, radius 15, 가운데 흰 구분선)
export function HomeTopActions({ onPressStorage, onPressShop }: Props) {
  return (
    <GlassSurface radius={15} style={styles.container}>
      <Pressable
        onPress={onPressStorage}
        accessibilityRole="button"
        accessibilityLabel="보관함"
        style={({ pressed }) => [styles.half, pressed && styles.pressed]}
      >
        <Image source={homeImages.storage} style={styles.icon} />
      </Pressable>
      <View style={styles.divider} />
      <Pressable
        onPress={onPressShop}
        accessibilityRole="button"
        accessibilityLabel="상점"
        style={({ pressed }) => [styles.half, pressed && styles.pressed]}
      >
        <Image source={homeImages.shop} style={styles.icon} />
      </Pressable>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    width: 115,
    height: 50,
  },
  half: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
  icon: {
    width: 36,
    height: 36,
  },
  divider: {
    width: 1,
    height: 48,
    backgroundColor: colors.glassIcon,
  },
});
