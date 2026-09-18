// 커스텀 폰트 이름 모음.
// Android는 android/app/src/main/assets/fonts/ 안의 "파일 이름(확장자 제외)"이 곧 fontFamily다.
// → MemomentKkukkukk.ttf 를 그 폴더에 넣고 앱을 다시 빌드하면 적용된다.
// 파일이 아직 없으면 Android가 시스템 기본 폰트로 대체하므로 앱이 죽지는 않는다.
export const fonts = {
  // 메모먼트 꾹꾹체 — 코인 수량, 하트 보상, 안내 문구 등 홈 화면 텍스트
  kkukkukk: 'MemomentKkukkukk',
};
