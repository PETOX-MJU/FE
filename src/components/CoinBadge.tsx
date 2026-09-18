import React from 'react';
import { Image, StyleSheet, Text } from 'react-native';
import { GlassSurface } from '@/components/GlassSurface';
import { homeImages } from '@/assets/images';
import { colors } from '@/theme/colors';
import { fonts } from '@/theme/fonts';

type Props = {
  amount: number;
};

// 상단 코인 pill (피그마 115 × 50, radius 15)
export function CoinBadge({ amount }: Props) {
  return (
    <GlassSurface radius={15} style={styles.container}>
      <Image source={homeImages.coin} style={styles.coinIcon} />
      <Text style={styles.amount} numberOfLines={1}>
        {amount}
      </Text>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    minWidth: 115,
    height: 50,
    paddingLeft: 9,
    paddingRight: 14,
    gap: 10,
  },
  coinIcon: {
    width: 29,
    height: 29,
  },
  amount: {
    color: colors.glassIcon,
    // 커스텀 폰트에 fontWeight를 주면 Android가 시스템 굵은 글꼴로 바꿔버려서 빼 둠
    fontFamily: fonts.kkukkukk,
    fontSize: 30,
    includeFontPadding: false,
  },
});
