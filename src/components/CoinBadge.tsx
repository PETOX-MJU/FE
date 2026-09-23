import React from 'react';
import { Image, StyleSheet, Text } from 'react-native';
import { GlassSurface } from '@/components/GlassSurface';
import { homeImages } from '@/assets/images';
import { colors } from '@/theme/colors';
import { fonts } from '@/theme/fonts';

type Props = {
  amount: number;
};

// 1234567 → "1,234,567" (Hermes 버전에 따라 toLocaleString 이 쉼표를 안 넣는 경우가 있어 직접 처리)
function formatCoins(n: number): string {
  return String(Math.max(0, Math.floor(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// 상단 코인 pill (피그마 50 높이, radius 15).
// 피그마는 115 폭 고정이지만, 코인 수가 적으면 오른쪽이 휑해서 숫자 길이에 맞춰 늘고 준다.
export function CoinBadge({ amount }: Props) {
  return (
    <GlassSurface radius={15} style={styles.container}>
      <Image source={homeImages.coin} style={styles.coinIcon} />
      <Text style={styles.amount} numberOfLines={1}>
        {formatCoins(amount)}
      </Text>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    height: 50,
    paddingLeft: 10,
    paddingRight: 16,
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
