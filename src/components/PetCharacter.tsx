import React, { useEffect, useRef, useState } from 'react';
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
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { homeImages } from '@/assets/images';
import { colors } from '@/theme/colors';
import { fonts } from '@/theme/fonts';

// 피그마 기준 스프라이트 크기(dp)와, 스프라이트 왼쪽 위 기준 하트(+5) 위치
const SPRITE_W = 82.2;
const SPRITE_H = 119.9;
const HEART_Y = -54.5;
const HEART_SIZE = 32;

type Props = {
  source: ImageSourcePropType;
  // 배경 배율 — 화면 높이가 피그마(917)와 다르면 펫도 배경과 같이 커지고 작아진다
  scale?: number;
  canClaim: boolean;
  rewardAmount: number;
  onTap: () => void;
  onLongPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function PetCharacter({
  source,
  scale: k = 1,
  canClaim,
  rewardAmount,
  onTap,
  onLongPress,
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
      // 코인 +5가 살짝 떠오르며 나타났다가(피그마 '탭' 상태) 천천히 사라짐
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
      {canClaim && <CheckInBubble k={k} petWidth={w} />}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.reward,
          // 코인 아이콘 + '+5' 묶음 전체를 펫 가운데에 맞춘다
          { width: w, top: HEART_Y * k, gap: 5 * k },
          rewardStyle,
        ]}
      >
        <Image
          source={homeImages.coin}
          style={{ width: HEART_SIZE * k, height: HEART_SIZE * k }}
        />
        <Text style={[styles.rewardText, { fontSize: 20 * k }]}>
          +{rewardAmount}
        </Text>
      </Animated.View>

      <Pressable
        onPress={handlePress}
        onLongPress={onLongPress}
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
          오늘은 이미 출석했어요
        </Text>
      )}
    </View>
  );
}

// 오늘 아직 출석 전일 때 펫 머리 위에 뜨는 말풍선. 둥실둥실 위아래로 움직인다.
// 픽셀 아트 톤에 맞춰 두꺼운 테두리 + 아래로 떨어지는 딱딱한 그림자, 코인 +5 를 같이 보여준다.
function CheckInBubble({ k, petWidth }: { k: number; petWidth: number }) {
  const bob = useSharedValue(0);
  useEffect(() => {
    bob.value = withRepeat(
      withSequence(
        withTiming(-4 * k, {
          duration: 700,
          easing: Easing.inOut(Easing.quad),
        }),
        withTiming(0, { duration: 700, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
    );
  }, [bob, k]);
  const bobStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: bob.value }],
  }));

  const bw = BUBBLE_W * k;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.bubbleWrap,
        { width: bw, left: (petWidth - bw) / 2, top: BUBBLE_Y * k },
        bobStyle,
      ]}
    >
      <View>
        {/* 딱딱한 그림자 */}
        <View
          style={[
            styles.bubbleShadow,
            {
              top: 3 * k,
              left: 3 * k,
              right: -3 * k,
              bottom: -3 * k,
              borderRadius: 12 * k,
            },
          ]}
        />
        {/* 꼬리 테두리 — 말풍선보다 먼저 그려 윗부분은 말풍선 뒤로 숨긴다 */}
        <View
          style={[
            styles.tail,
            styles.tailBorder,
            { width: 12 * k, height: 12 * k, bottom: -6 * k },
          ]}
        />
        <View
          style={[
            styles.bubble,
            {
              paddingHorizontal: 10 * k,
              paddingVertical: 6 * k,
              borderRadius: 12 * k,
              borderWidth: 2 * k,
              gap: 4 * k,
            },
          ]}
        >
          <Text style={[styles.bubbleText, { fontSize: 13 * k }]}>
            쓰다듬고 출석!
          </Text>
          <Image
            source={homeImages.coin}
            style={{ width: 15 * k, height: 15 * k }}
          />
          <Text style={[styles.bubbleCoin, { fontSize: 13 * k }]}>+5</Text>
        </View>
        {/* 꼬리 안쪽 — 말풍선 아래 테두리를 지워 꼬리와 이어지게 */}
        <View
          style={[styles.tail, { width: 8 * k, height: 8 * k, bottom: -3 * k }]}
        />
      </View>
    </Animated.View>
  );
}

const BUBBLE_W = 150;
const BUBBLE_Y = -44;
const BUBBLE_BORDER = '#3A2A1E';

const HINT_W = 220;

const styles = StyleSheet.create({
  reward: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    left: 0,
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
  bubbleWrap: {
    position: 'absolute',
    alignItems: 'center',
    zIndex: 2,
  },
  bubbleShadow: {
    position: 'absolute',
    backgroundColor: 'rgba(58,42,30,0.25)',
  },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFDF6',
    borderColor: BUBBLE_BORDER,
  },
  bubbleText: {
    color: BUBBLE_BORDER,
    fontFamily: fonts.kkukkukk,
    includeFontPadding: false,
  },
  bubbleCoin: {
    color: '#D98A00',
    fontFamily: fonts.kkukkukk,
    includeFontPadding: false,
  },
  tail: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: '#FFFDF6',
    transform: [{ rotate: '45deg' }],
  },
  tailBorder: {
    backgroundColor: BUBBLE_BORDER,
  },
});
