import React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { usePixelSize } from '@/components/PixelRig';

// 강아지 + 안내 문구가 있는 화면(가입 인증 대기 → 온보딩 환영)에서 강아지 자리를 똑같이 잡는다.
// 화면 높이 비율로 위 여백을 주고, 강아지 칸 높이를 고정한 뒤 발끝을 칸 바닥에 맞춘다.
// 그래서 강아지 그림의 여백이 달라도 두 화면이 넘어갈 때 강아지 발 위치와 제목 위치가 같다.

/** 가장 큰 강아지 그림(환영, 도트 43칸) 기준 칸 높이 */
const STAGE_PX = 43;
const TOP_RATIO = 0.13;

export function PetHero({ children }: { children: React.ReactNode }) {
  const { height } = useWindowDimensions();
  const pixel = usePixelSize();
  return (
    <View
      style={[
        styles.stage,
        { marginTop: Math.round(height * TOP_RATIO), height: STAGE_PX * pixel },
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { alignItems: 'center', justifyContent: 'flex-end' },
});
