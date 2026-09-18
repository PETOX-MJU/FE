// 피그마 home_screen(peTox_Design > UI_Design)에서 뽑은 이미지 에셋 모음.
// 아이콘은 @3x(피그마 크기 × 3) PNG라서 화면에는 피그마 크기(dp)로 그리면 된다.

export const homeImages = {
  // 기본 테마(초원). 피그마 목업처럼 좌우 반전된 버전 — 해가 왼쪽에 와서 상단 버튼과 안 겹침
  background: require('./home/bg_meadow.jpg'),
  coin: require('./home/ic_coin.png'), // 29 × 29
  heart: require('./home/ic_heart.png'), // 32 × 32
  storage: require('./home/ic_box.png'), // 보관함 36 × 36
  shop: require('./home/ic_shop.png'), // 상점 36 × 36
  report: require('./home/ic_report.png'), // 리포트 36 × 40
  home: require('./home/ic_home.png'), // 홈 51 × 51
  character: require('./home/ic_character.png'), // 캐릭터 39 × 40
};

// 배경 원본 비율(941 × 1672)
export const HOME_BG_ASPECT = 941 / 1672;

// 온보딩에서 고른 펫 → 스프라이트. 새 캐릭터는 여기에 한 줄씩 추가하면 된다.
// 스프라이트는 픽셀 1칸 = 10px 로 키운 PNG (24 × 35칸 → 240 × 350)
export const petImages = {
  rottweiler: require('./pets/pet_rottweiler.png'),
};

export type PetId = keyof typeof petImages;
