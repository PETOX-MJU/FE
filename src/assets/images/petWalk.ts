import type { ImageSourcePropType } from 'react-native';
import type { PetId } from '@/constants/onboardingStrings';

/**
 * 펫 걷기 프레임 (왼쪽을 보고 걷는 그림 6장, 0.15초 간격).
 * 원본: design peTox_픽셀 의 걷기 GIF (골든은 오른쪽으로 걷는 그림이라 좌우 반전).
 * 오른쪽으로 걸을 땐 화면에서 좌우를 뒤집어 쓴다.
 * 웰시코기는 걷기 그림이 아직 없다.
 */
export type PetWalk = {
  frames: ImageSourcePropType[];
  /** 걷기 프레임 한 장의 도트 칸 수 (가로·세로) */
  pxW: number;
  pxH: number;
  /**
   * 앉은 그림(home/<견종>.png, 240×350) 세로 전체가 도트 몇 칸에 해당하는지.
   * 앉은 그림은 정면 도트를 늘려 담은 것이라 견종마다 다르다 — 이 값으로 걷는 그림을
   * 같은 도트 크기로 맞춘다. (골든은 위쪽 여백이 있어 36칸이 350px 중 262px 에 들어 있음)
   */
  sitPxH: number;
};

export const petWalk: Partial<Record<PetId, PetWalk>> = {
  golden: {
    frames: [
      require('./pets/walk/golden_walk_0.png'),
      require('./pets/walk/golden_walk_1.png'),
      require('./pets/walk/golden_walk_2.png'),
      require('./pets/walk/golden_walk_3.png'),
      require('./pets/walk/golden_walk_4.png'),
      require('./pets/walk/golden_walk_5.png'),
    ],
    pxW: 48,
    pxH: 34,
    sitPxH: (36 * 350) / 262,
  },
  dachshund: {
    frames: [
      require('./pets/walk/dachshund_walk_0.png'),
      require('./pets/walk/dachshund_walk_1.png'),
      require('./pets/walk/dachshund_walk_2.png'),
      require('./pets/walk/dachshund_walk_3.png'),
      require('./pets/walk/dachshund_walk_4.png'),
      require('./pets/walk/dachshund_walk_5.png'),
    ],
    pxW: 47,
    pxH: 33,
    sitPxH: 35,
  },
  husky: {
    frames: [
      require('./pets/walk/husky_walk_0.png'),
      require('./pets/walk/husky_walk_1.png'),
      require('./pets/walk/husky_walk_2.png'),
      require('./pets/walk/husky_walk_3.png'),
      require('./pets/walk/husky_walk_4.png'),
      require('./pets/walk/husky_walk_5.png'),
    ],
    pxW: 50,
    pxH: 37,
    sitPxH: 37,
  },
};

/** 앉은 그림 높이(dp)가 h 일 때 같은 도트 크기의 걷는 그림 크기 */
export function walkSize(walk: PetWalk, sitH: number) {
  const dp = sitH / walk.sitPxH; // 도트 한 칸 = dp
  return { width: walk.pxW * dp, height: walk.pxH * dp };
}

export const PET_WALK_FRAME_MS = 150;
