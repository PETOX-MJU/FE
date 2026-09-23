import React, { useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { petoxColors } from '@/theme/petox';

// 시안 실측: 전체 높이 20dp, 가운데 막대 13dp, 양 끝 돌기가 위아래로 3.5dp 씩 튀어나옴.
const H = 20;
const KNOB = 13; // 돌기(원) 지름
const BAR_H = 13; // 가운데 막대 높이
const BAR_TOP = (H - BAR_H) / 2;

/** 뼈다귀 한 벌: 가운데 막대 + 양 끝에 위아래로 붙은 원 4개. */
function BoneShape({ color, width }: { color: string; width: number }) {
  return (
    <View style={{ width, height: H }}>
      <View
        style={[
          styles.bar,
          {
            backgroundColor: color,
            top: BAR_TOP,
            height: BAR_H,
            left: KNOB / 2,
            right: KNOB / 2,
          },
        ]}
      />
      {[
        { left: 0, top: 0 },
        { left: 0, top: H - KNOB },
        { right: 0, top: 0 },
        { right: 0, top: H - KNOB },
      ].map((pos, i) => (
        <View key={i} style={[styles.knob, pos, { backgroundColor: color }]} />
      ))}
    </View>
  );
}

type Props = {
  /** 0~100 */
  percent: number;
};

/** 뼈다귀 모양 진행 게이지. 회색 뼈다귀 위에 초록 뼈다귀를 왼쪽부터 드러냅니다. */
export function BoneProgress({ percent }: Props) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const ratio = Math.min(100, Math.max(0, percent)) / 100;

  return (
    <View style={styles.track} onLayout={onLayout}>
      <BoneShape color="#D9D9D9" width={width} />
      <View style={[styles.clip, { width: width * ratio }]}>
        <BoneShape color={petoxColors.green} width={width} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: '70%', alignSelf: 'center', height: H },
  clip: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: H,
    overflow: 'hidden',
  },
  bar: { position: 'absolute', borderRadius: BAR_H / 2 },
  knob: {
    position: 'absolute',
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
  },
});
