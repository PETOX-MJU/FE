import React, { useEffect } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import {
  Easing,
  cancelAnimation,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { RigLayer, usePixelSize } from '@/components/PixelRig';

// 편지를 문 골든리트리버 (가입 인증 메일 대기 화면).
// 몸은 가만히, 머리(+문 편지)만 목을 축으로 좌우로 갸우뚱한다.
const BODY = require('../assets/images/pets/mail_dog_body.png');
const HEAD = require('../assets/images/pets/mail_dog_head.png');
const NECK = { x: 0.549, y: 0.561 }; // 캔버스 328×328 기준
const TILT_DEG = 10;

// 캔버스 = 도트 41×41칸 (8배 PNG 328×328)
const CANVAS_PX = 41;

type Props = {
  /** 세로 크기. 없으면 화면 비율에 맞춘 기본 크기 (환영 강아지와 같은 도트 크기) */
  size?: number;
  style?: StyleProp<ViewStyle>;
};

export function MailDog({ size: sizeProp, style }: Props) {
  const pixel = usePixelSize();
  const size = sizeProp ?? CANVAS_PX * pixel;
  const tilt = useSharedValue(0);

  useEffect(() => {
    const ease = Easing.inOut(Easing.quad);
    tilt.value = withRepeat(
      withSequence(
        withTiming(TILT_DEG, { duration: 450, easing: ease }),
        withDelay(350, withTiming(-TILT_DEG, { duration: 700, easing: ease })),
        withDelay(350, withTiming(0, { duration: 450, easing: ease })),
        withDelay(500, withTiming(0, { duration: 0 })),
      ),
      -1,
    );
    return () => cancelAnimation(tilt);
  }, [tilt]);

  return (
    <View style={[{ width: size, height: size }, style]}>
      <RigLayer source={BODY} width={size} height={size} />
      <RigLayer
        source={HEAD}
        width={size}
        height={size}
        pivot={NECK}
        angle={tilt}
      />
    </View>
  );
}
