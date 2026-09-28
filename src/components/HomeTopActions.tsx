import React from 'react';
import { Image, Pressable, StyleSheet } from 'react-native';
import { GlassSurface } from '@/components/GlassSurface';
import { homeImages } from '@/assets/images';
import { colors } from '@/theme/colors';

type Props = {
  onPressShop?: () => void;
  // 상점 패널이 열려 있으면 상점 버튼이 닫기(X)로 바뀐다
  shopOpen?: boolean;
};

// 상단 오른쪽 상점 버튼 (피그마 높이 50, radius 15).
// 예전엔 보관함 | 상점 두 칸이었는데, 보관함은 기능이 없어서 뺐다 (9/29).
export function HomeTopActions({ onPressShop, shopOpen = false }: Props) {
  return (
    <GlassSurface radius={15} style={styles.container}>
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
    width: 57,
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
});
