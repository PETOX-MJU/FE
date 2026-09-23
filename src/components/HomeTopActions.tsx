import React from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { GlassSurface } from '@/components/GlassSurface';
import { homeImages } from '@/assets/images';
import { colors } from '@/theme/colors';

type Props = {
  onPressStorage?: () => void;
  onPressShop?: () => void;
  // 상점 패널이 열려 있으면 상점 버튼이 닫기(X)로 바뀐다
  shopOpen?: boolean;
};

// 상단 오른쪽 보관함 | 상점 pill (피그마 115 × 50, radius 15, 가운데 흰 구분선)
export function HomeTopActions({
  onPressStorage,
  onPressShop,
  shopOpen = false,
}: Props) {
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
        accessibilityLabel={shopOpen ? '상점 닫기' : '상점'}
        style={({ pressed }) => [styles.half, pressed && styles.pressed]}
      >
        <Image
          source={shopOpen ? homeImages.close : homeImages.shop}
          // 닫기 아이콘 원본은 진한 회색이라, 다른 아이콘처럼 흰색으로 물들여 쓴다
          style={[styles.icon, shopOpen && styles.closeIcon]}
        />
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
  closeIcon: {
    tintColor: colors.glassIcon,
  },
  divider: {
    width: 1,
    height: 48,
    backgroundColor: colors.glassIcon,
  },
});
