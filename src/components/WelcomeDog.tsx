import React, { useEffect } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import {
  Easing,
  cancelAnimation,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { RigLayer, usePixelSize } from '@/components/PixelRig';

// 환영하는 골든리트리버 (온보딩 환영 화면) — 앉아서 꼬리를 살랑살랑, 고개를 갸웃갸웃.
// 머리 그림은 목·가슴 윗부분까지 포함하고 몸 그림을 그 위에 덮어서,
// 고개를 기울여도 머리 아랫부분이 몸 뒤로 숨어 잘린 선·빈틈이 안 보인다.
const BODY = require('../assets/images/pets/welcome_body.png');
const HEAD = require('../assets/images/pets/welcome_head.png');
const TAIL = require('../assets/images/pets/welcome_tail.png');
const ASPECT = 360 / 344; // 가로 / 세로
const CANVAS_PX_H = 43; // 캔버스 세로 = 도트 43칸 (8배 PNG 344)
const TAIL_BASE = { x: 0.311, y: 0.884 };
const NECK = { x: 0.544, y: 0.605 };

type Props = {
  /** 세로 크기. 없으면 화면 비율에 맞춘 기본 크기 (편지 강아지와 같은 도트 크기) */
  size?: number;
  style?: StyleProp<ViewStyle>;
};

export function WelcomeDog({ size: sizeProp, style }: Props) {
  const pixel = usePixelSize();
  const size = sizeProp ?? CANVAS_PX_H * pixel;
  const width = size * ASPECT;
  const tail = useSharedValue(0);
  const head = useSharedValue(0);

  useEffect(() => {
    // 에뮬레이터·개발 모드에서도 끊겨 보이지 않게, 폭은 줄이고 한 번 흔드는 시간은 늘려
    // 사인 곡선으로 부드럽게 왕복한다 (reverse: 끝에서 되돌아옴).
    const sine = Easing.inOut(Easing.sin);
    tail.value = -16;
    tail.value = withRepeat(
      withTiming(6, { duration: 280, easing: sine }),
      -1,
      true,
    );
    head.value = -6;
    head.value = withRepeat(
      withTiming(6, { duration: 1400, easing: sine }),
      -1,
      true,
    );
    return () => {
      cancelAnimation(tail);
      cancelAnimation(head);
    };
  }, [tail, head]);

  return (
    <View style={[{ width, height: size }, style]}>
      <RigLayer
        source={TAIL}
        width={width}
        height={size}
        pivot={TAIL_BASE}
        angle={tail}
      />
      <RigLayer
        source={HEAD}
        width={width}
        height={size}
        pivot={NECK}
        angle={head}
      />
      <RigLayer source={BODY} width={width} height={size} />
    </View>
  );
}
