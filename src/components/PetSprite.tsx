import React from 'react';
import { Image, ImageStyle, StyleProp } from 'react-native';
import type { PetId } from '@/constants/onboardingStrings';

/** 펫이 바라보는 방향. 원본 스프라이트가 4방향으로 제공됩니다. */
export type PetDirection = 'front' | 'back' | 'left' | 'right';

// require 는 정적 경로만 받으므로 전부 나열합니다.
const SOURCES: Record<PetId, Record<PetDirection, number>> = {
  golden: {
    front: require('../assets/images/pets/golden_front.png'),
    back: require('../assets/images/pets/golden_back.png'),
    left: require('../assets/images/pets/golden_left.png'),
    right: require('../assets/images/pets/golden_right.png'),
  },
  dachshund: {
    front: require('../assets/images/pets/dachshund_front.png'),
    back: require('../assets/images/pets/dachshund_back.png'),
    left: require('../assets/images/pets/dachshund_left.png'),
    right: require('../assets/images/pets/dachshund_right.png'),
  },
  corgi: {
    front: require('../assets/images/pets/corgi_front.png'),
    back: require('../assets/images/pets/corgi_back.png'),
    left: require('../assets/images/pets/corgi_left.png'),
    right: require('../assets/images/pets/corgi_right.png'),
  },
  husky: {
    front: require('../assets/images/pets/husky_front.png'),
    back: require('../assets/images/pets/husky_back.png'),
    left: require('../assets/images/pets/husky_left.png'),
    right: require('../assets/images/pets/husky_right.png'),
  },
};

type Props = {
  pet: PetId;
  /** 기준 크기(높이). width 를 주지 않으면 정사각형. */
  size: number;
  /** 너비를 따로 지정하면 비율을 깨고 가로만 압축합니다. */
  width?: number;
  direction?: PetDirection;
  style?: StyleProp<ImageStyle>;
};

/** 픽셀 펫 스프라이트. 원본 도트가 뭉개지지 않도록 그대로 확대합니다. */
export function PetSprite({
  pet,
  size,
  width,
  direction = 'front',
  style,
}: Props) {
  const squashed = width !== undefined && width !== size;
  return (
    <Image
      source={SOURCES[pet][direction]}
      style={[{ width: width ?? size, height: size }, style]}
      // contain 은 비율을 지키느라 전체가 작아지므로, 가로만 줄일 때는 stretch.
      resizeMode={squashed ? 'stretch' : 'contain'}
    />
  );
}
