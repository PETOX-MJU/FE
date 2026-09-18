import React, { useRef, useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { homeImages } from '@/assets/images';
import { colors } from '@/theme/colors';
import { fonts } from '@/theme/fonts';

// 피그마 기준 스프라이트 크기(dp)와, 스프라이트 왼쪽 위 기준 하트(+5) 위치
const SPRITE_W = 82.2;
const SPRITE_H = 119.9;
const HEART_X = 26.6;
const HEART_Y = -54.5;
const HEART_SIZE = 32;

type Props = {
  source: ImageSourcePropType;
  // 배경 배율 — 화면 높이가 피그마(917)와 다르면 펫도 배경과 같이 커지고 작아진다
  scale?: number;
  canClaim: boolean;
  rewardAmount: number;
  onTap: () => void;
  style?: StyleProp<ViewStyle>;
};

export function PetCharacter({
  source,
  scale: k = 1,
  canClaim,
  rewardAmount,
  onTap,
  style,
}: Props) {
  const [alreadyClaimedHint, setAlreadyClaimedHint] = useState(false);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const bodyScale = useSharedValue(1);
  const rewardOpacity = useSharedValue(0);
  const rewardTranslateY = useSharedValue(0);

  const bodyStyle = useAnimatedStyle(() => ({
    transform: [{ scale: bodyScale.value }],
  }));

  const rewardStyle = useAnimatedStyle(() => ({
    opacity: rewardOpacity.value,
    transform: [{ translateY: rewardTranslateY.value }],
  }));

  const handlePress = () => {
    bodyScale.value = withSequence(
      withTiming(0.92, { duration: 80, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: 160, easing: Easing.out(Easing.back(2)) }),
    );

    if (canClaim) {
      onTap();
      // 하트 +5가 살짝 떠오르며 나타났다가(피그마 '탭' 상태) 천천히 사라짐
      rewardTranslateY.value = 8;
      rewardTranslateY.value = withTiming(0, {
        duration: 300,
        easing: Easing.out(Easing.back(1.6)),
      });
      rewardOpacity.value = withSequence(
        withTiming(1, { duration: 200 }),
        withDelay(1200, withTiming(0, { duration: 500 })),
      );
    } else {
      setAlreadyClaimedHint(true);
      if (hintTimer.current) {
        clearTimeout(hintTimer.current);
      }
      hintTimer.current = setTimeout(() => setAlreadyClaimedHint(false), 1200);
    }
  };

  const w = SPRITE_W * k;
  const h = SPRITE_H * k;

  return (
    <View style={[{ width: w, height: h }, style]}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.reward,
          { left: HEART_X * k, top: HEART_Y * k, gap: 5 * k },
          rewardStyle,
        ]}
      >
        <Image
          source={homeImages.heart}
          style={{ width: HEART_SIZE * k, height: HEART_SIZE * k }}
        />
        <Text style={[styles.rewardText, { fontSize: 20 * k }]}>
          +{rewardAmount}
        </Text>
      </Animated.View>

      <Pressable
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel="펫 쓰다듬기"
        hitSlop={12}
      >
        <Animated.View style={bodyStyle}>
          <Image source={source} style={{ width: w, height: h }} />
        </Animated.View>
      </Pressable>

      {alreadyClaimedHint && (
        <Text
          pointerEvents="none"
          style={[styles.hint, { top: h + 6, left: (w - HINT_W) / 2 }]}
        >
          오늘은 이미 쓰다듬었어요
        </Text>
      )}
    </View>
  );
}

const HINT_W = 220;

const styles = StyleSheet.create({
  reward: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 1,
  },
  rewardText: {
    color: colors.glassIcon,
    fontFamily: fonts.kkukkukk,
    includeFontPadding: false,
  },
  hint: {
    position: 'absolute',
    width: HINT_W,
    textAlign: 'center',
    color: '#FFFFFF',
    fontFamily: fonts.kkukkukk,
    fontSize: 15,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowRadius: 4,
    textShadowOffset: { width: 0, height: 1 },
  },
});
