/** 회원가입 이후 온보딩 문구 — design/스크린샷 2026-09-19 시안 기준. */
export const onboardingStrings = {
  next: '다음',

  // 1단계: 사용 목표
  goalTitle: '하루에 숏폼 시청 목표를\n설정해 볼까요?',
  goalSubtitle: '하루 허용량입니다. 추후 수정 가능',
  goalHint: '~~ 해당 시간이 넘어가면 펫이 나옵니다 ~~',

  // 2단계: 방지 시간대
  blockTitle: '숏폼 방지 시간대를\n설정해 볼까요?',
  blockSubtitle: '추천 시간대',
  blockCustom: '+ 직접 설정',

  // 2단계 - 직접 설정 화면
  customTimeSubtitle: '펫이 나타나는 시간대입니다. 추후 수정 가능',
  customTimeStartLabel: '0시',
  customTimeEndLabel: '23시',

  // 3단계: 캐릭터 선택
  characterTitle: '캐릭터를 설정해 주세요',
  characterSubtitle: '기본 캐릭터를 고르거나, 내 반려동물 사진으로\n만들 수 있어요',
  characterFromPhoto: '내 반려동물 사진으로 만들기',

  // 3단계 - 반려동물 사진으로 만들기
  petPhotoTitle: '얼굴이 잘 보이는\n사진 1장을 첨부해 주세요',
  petPhotoPlaceholder: '사진 미리보기 영역',
  petPhotoCamera: '카메라로 촬영',
  petPhotoAlbum: '앨범에서 선택',
  petPhotoGuideTitle: '정확한 캐릭터화를 위해',
  petPhotoGuide1: '· 배경이 단순하고 한 마리만 있는 사진을 넣어주세요',
  petPhotoGuide2: '· 사진은 기기 안에서만 처리됩니다',
  petPhotoSubmit: '나만의 캐릭터 만들기',

  // 3단계 - 사진 -> 픽셀 캐릭터 변환 중
  convertTitle: '변환 중',
  convertGuideTitle: '픽셀 캐릭터로 변환 중',
  convertGuide1: '· 기기 안에서 처리하고 있어요',

  // 4단계: 캐릭터 확정
  confirmTitle: '이 캐릭터로 할까요?',
  confirmNameHint: '이름을 지어주세요',
  confirmSubmit: '확정하고 홈으로',
  confirmErrorName: '이름을 지어주세요',
  confirmErrorSave: '저장하지 못했어요. 다시 시도해 주세요.',
} as const;

/** 1단계 프리셋 칩 (분 단위). */
export const GOAL_PRESETS = [30, 60, 120, 180] as const;

/** 2단계 추천 시간대 카드. */
export const BLOCK_SLOTS = [
  { id: 'bedtime', icon: '💤', label: '취침 전', range: '22:00~01:00' },
  { id: 'evening', icon: '🌙', label: '저녁 시간', range: '19:00 ~ 21:00' },
] as const;

/** 3단계 기본 캐릭터 — design/강아지 사진 파일들 의 픽셀아트. 배치 순서 = 화면 2열 그리드 순서. */
export const PETS = [
  { id: 'golden', name: '골든리트리버' },
  { id: 'dachshund', name: '닥스훈트' },
  { id: 'corgi', name: '웰시코기' },
  { id: 'husky', name: '허스키' },
] as const;

export type PetId = (typeof PETS)[number]['id'];

/** 목표 시간(분)을 "1시간 30분" 형태로. */
export function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}분`;
  if (m === 0) return `${h}시간`;
  return `${h}시간 ${m}분`;
}
