# 폰트 넣는 곳

메모먼트 꾹꾹체 파일을 이 폴더에 **`MemomentKkukkukk.ttf`** 이름으로 넣어 주세요
(OTF라면 `MemomentKkukkukk.otf`).

- Android는 파일 이름이 곧 `fontFamily` 이름이라 철자가 정확히 같아야 해요.
- 파일을 넣은 뒤에는 `npm run android`로 **다시 빌드**해야 적용돼요 (Metro 리로드만으로는 안 됨).
- 코드에서 쓰는 이름은 `src/theme/fonts.ts`에 모여 있어요.
- 라이선스상 폰트 파일 재배포가 금지라, 저장소에 커밋할지는 팀에서 확인 후 결정하세요.
