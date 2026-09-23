import React from 'react';
import Svg, { Path } from 'react-native-svg';

/**
 * 화면 상단 뒤로가기 화살표 (피그마 마이페이지 icon, 12 × 21, #020202).
 * 대시보드·마이페이지 등 헤더에서 같은 크기로 쓰도록 공용으로 둔다.
 */
export function BackChevron({ color = '#020202' }: { color?: string }) {
  return (
    <Svg width={12} height={21} viewBox="0 0 12 21">
      <Path
        d="M10.5 1.5 L1.8 10.4 L10.5 19.3"
        stroke={color}
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}
