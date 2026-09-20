/**
 * Petox 브랜드 토큰 — fe_mk_1(Kotlin/Compose) 의 ui/theme/Color.kt 에서 옮겨왔습니다.
 *
 * 기존 src/theme/colors.ts 는 건드리지 않았습니다. 팀 공용 토큰이 정리되면
 * 그쪽으로 합치고 이 파일은 지우면 됩니다.
 */
export const petoxColors = {
  green: '#85C482',
  greenDark: '#5FA95C',
  greenLight: '#D6E9D3',

  kakaoYellow: '#FFDF35',
  kakaoLabel: '#191600',

  black: '#000000',
  white: '#FFFFFF',

  hint: '#9E9E9E',
  line: '#DADADA',
  text: '#1A1A1A',
} as const;

/** 브랜드 손글씨체. assets/fonts/MemomentKkukkukk.ttf 를 링크하면 잡힙니다. */
export const petoxFont = 'MemomentKkukkukk';

/**
 * 앱 기본 글씨체. RN 은 전역 폰트 설정이 없어서 Text/TextInput 스타일마다
 * fontFamily 를 지정해야 합니다. 새 화면을 만들 때 이 값을 함께 깔아주세요.
 */
export const petoxTextBase = {
  fontFamily: petoxFont,
} as const;

export const petoxLayout = {
  screenPadding: 24,
  buttonHeight: 52,
  buttonRadius: 12,
} as const;
