import React from 'react';
import {
  Image,
  StyleSheet,
  useWindowDimensions,
  type ImageSourcePropType,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';

// 도트 캐릭터를 부위별 그림(같은 캔버스 크기)으로 나눠 겹치고, 부위마다 축을 잡아 돌린다.
// transformOrigin 은 안드로이드에서 애니메이션 중 축이 틀어지는 경우가 있어서,
// "축까지 옮기고 → 돌리고 → 되돌리기" 로 직접 계산한다.

/**
 * 도트 1칸을 화면에서 몇 dp 로 그릴지. 화면 가로에 비례하고 너무 작거나 크지 않게 묶는다.
 * 강아지 그림마다 이 값 × 원본 칸 수로 크기를 정해서, 화면이 달라도 강아지끼리 크기가 같다.
 */
export function usePixelSize(): number {
  const { width } = useWindowDimensions();
  return Math.min(4.2, Math.max(2.8, width * 0.0095));
}

type LayerProps = {
  source: ImageSourcePropType;
  width: number;
  height: number;
  /** 회전 축 (캔버스 비율 0~1) */
  pivot?: { x: number; y: number };
  /** 회전 각도(도). 없으면 고정 */
  angle?: SharedValue<number>;
};

export function RigLayer({ source, width, height, pivot, angle }: LayerProps) {
  const dx = ((pivot?.x ?? 0.5) - 0.5) * width;
  const dy = ((pivot?.y ?? 0.5) - 0.5) * height;

  const animated = useAnimatedStyle(() => {
    const a = angle ? angle.value : 0;
    return {
      transform: [
        { translateX: dx },
        { translateY: dy },
        { rotate: `${a}deg` },
        { translateX: -dx },
        { translateY: -dy },
      ],
    };
  });

  return (
    <Animated.View style={[styles.layer, { width, height }, animated]}>
      <Image
        source={source}
        fadeDuration={0}
        resizeMode="stretch"
        style={{ width, height }}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', top: 0, left: 0 },
});
