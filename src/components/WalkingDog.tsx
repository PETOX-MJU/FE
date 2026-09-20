import React, { useEffect, useMemo, useState } from 'react';
import { Image, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

// 원본 GIF(design/강아지 사진 파일들/골든리트리버/골든_걷기.gif)의 6프레임.
// Android 에 Fresco animated-gif 의존성이 없어 GIF 를 그대로 쓰면 첫 프레임만
// 정지 상태로 보이므로, 프레임을 PNG 로 뽑아 여기서 직접 돌립니다.
const FRAMES = [
  require('../assets/images/pets/golden_walk_0.png'),
  require('../assets/images/pets/golden_walk_1.png'),
  require('../assets/images/pets/golden_walk_2.png'),
  require('../assets/images/pets/golden_walk_3.png'),
  require('../assets/images/pets/golden_walk_4.png'),
  require('../assets/images/pets/golden_walk_5.png'),
];

/** 원본 GIF 의 프레임 간격. */
const FRAME_MS = 200;

type Props = {
  size: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * 걷는 골든리트리버.
 *
 * source 를 갈아끼우면 프레임마다 이미지를 새로 읽느라 깜빡이므로,
 * 여섯 장을 같은 자리에 겹쳐 두고 현재 프레임만 보이게 합니다.
 */
export function WalkingDog({ size, style }: Props) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const timer = setInterval(
      () => setFrame(f => (f + 1) % FRAMES.length),
      FRAME_MS,
    );
    return () => clearInterval(timer);
  }, []);

  // absoluteFill 은 부모 크기를 못 받는 경우가 있어 크기를 직접 지정합니다.
  const box = useMemo(
    () => ({ width: size, height: size }),
    [size],
  );
  const frameStyle = useMemo(
    () => ({ position: 'absolute' as const, top: 0, left: 0, ...box }),
    [box],
  );

  return (
    <View style={[box, style]}>
      {FRAMES.map((src, i) => (
        <Image
          key={i}
          source={src}
          style={[frameStyle, i === frame ? styles.visible : styles.hidden]}
          resizeMode="contain"
          fadeDuration={0}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  visible: { opacity: 1 },
  hidden: { opacity: 0 },
});
