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
import {
  PET_WALK_FRAME_MS,
  walkSize,
  type PetWalk,
} from '@/assets/images/petWalk';
import { colors } from '@/theme/colors';
import { fonts } from '@/theme/fonts';

// 피그마 기준 스프라이트 크기(dp)와, 스프라이트 왼쪽 위 기준 하트(+5) 위치
export const PET_SPRITE_W = 82.2;
const SPRITE_W = PET_SPRITE_W;
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
  /** 걷기 그림(왼쪽을 보고 걷는 프레임 + 도트 크기). 있으면 가끔 좌우로 걸어다닌다 */
  walk?: PetWalk;
  /** 제자리 기준으로 걸어갈 수 있는 가로 범위(dp) — 화면 밖으로 안 나가게 */
  roam?: { min: number; max: number };
};

/** 걷는 속도(dp/초, 배경 배율 1 기준)와 쉬는 시간 */
const WALK_SPEED = 45;
const REST_MIN_MS = 3500;
const REST_MAX_MS = 8000;

export function PetCharacter({
  source,
  scale: k = 1,
  canClaim,
  rewardAmount,
  onTap,
  onLongPress,
  style,
  walk,
  roam,
}: Props) {
  const walkFrames = walk?.frames;
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

  // ---- 돌아다니기: 쉬었다가(앉은 모습) → 좌우 아무 데나 걸어가서 → 다시 앉는다 ----
  const roamX = useSharedValue(0);
  const posX = useRef(0);
  const [walking, setWalking] = useState(false);
  const [facingRight, setFacingRight] = useState(false);
  const [frame, setFrame] = useState(0);
  const canRoam = !!walkFrames?.length && !!roam && roam.max - roam.min > 40;
  const roamMin = roam?.min ?? 0;
  const roamMax = roam?.max ?? 0;

  useEffect(() => {
    if (!canRoam) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const rest = () => {
      timer = setTimeout(
        walkOnce,
        REST_MIN_MS + Math.random() * (REST_MAX_MS - REST_MIN_MS),
      );
    };
    const walkOnce = () => {
      if (!alive) return;
      const from = posX.current;
      const to = roamMin + Math.random() * (roamMax - roamMin);
      if (Math.abs(to - from) < 30 * k) return rest();
      const ms = (Math.abs(to - from) / (WALK_SPEED * k)) * 1000;
      setFacingRight(to > from);
      setWalking(true);
      roamX.value = withTiming(to, { duration: ms, easing: Easing.linear });
      timer = setTimeout(() => {
        posX.current = to;
        setWalking(false);
        rest();
      }, ms);
    };
    rest();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [canRoam, roamMin, roamMax, k, roamX]);

  // 걷는 동안만 프레임을 넘긴다
  useEffect(() => {
    if (!walking) return;
    const t = setInterval(
      () => setFrame(f => (f + 1) % (walkFrames?.length ?? 1)),
      PET_WALK_FRAME_MS,
    );
    return () => clearInterval(t);
  }, [walking, walkFrames]);

  const roamStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: roamX.value }],
  }));

  // 앉은 그림과 도트 한 칸 크기가 같도록 — 발끝을 맞추고 가운데 정렬
  const { width: walkW, height: walkH } = walk
    ? walkSize(walk, h)
    : { width: 0, height: 0 };

  return (
    <Animated.View style={[{ width: w, height: h }, style, roamStyle]}>
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
          {/* 앉은 모습 — 걷는 동안엔 숨긴다 (지우지 않아서 다시 앉을 때 깜빡이지 않는다) */}
          <Image
            source={source}
            style={[{ width: w, height: h }, walking && styles.hidden]}
          />
          {walkFrames?.map((src, i) => (
            <Image
              key={i}
              source={src}
              fadeDuration={0}
              style={[
                styles.walkFrame,
                {
                  width: walkW,
                  height: walkH,
                  left: (w - walkW) / 2,
                  transform: [{ scaleX: facingRight ? -1 : 1 }],
                },
                !(walking && i === frame) && styles.hidden,
              ]}
            />
          ))}
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
    </Animated.View>
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
  hidden: { opacity: 0 },
  walkFrame: { position: 'absolute', bottom: 0 },
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
