import cases from './fixtures/slmCases.json';
import { failures, fill, hasBatchim, toFact, weekSeed } from '../src/features/screentime/slmCheck';

// Python(AI 저장소 slm_summary/export_cases.py)이 낸 판정과 전부 같아야 한다.
test.each(cases.checks.map(c => [c.out, c]))('Python 과 같은 판정: %s', (_out, c) => {
  expect(failures(c.fact, c.out)).toEqual(c.fail);
});

test.each(cases.fills.map(c => [c.app, c.out, c]))('Python 과 같은 fill: %s / %s', (_app, _out, c) => {
  expect(fill(c.out, c.app)).toBe(c.shown);
});

test('영문 앱 이름 조사', () => {
  expect(fill('{앱:을} 가장 많이 봤어요', 'TikTok')).toBe('TikTok을 가장 많이 봤어요');
  expect(fill('{앱:을} 가장 많이 봤어요', 'YouTube')).toBe('YouTube를 가장 많이 봤어요');
  expect(hasBatchim('TV')).toBe(false);
  expect(hasBatchim('9')).toBe(false);
});

test('NIGHT_TOP_APP 만 패키지명을 {앱} 으로 바꾼다', () => {
  const night = {
    code: 'NIGHT_TOP_APP',
    evidence: { package_name: 'com.google.android.youtube' },
    text: '취침 전후로 가장 오래 사용한 앱은 com.google.android.youtube이고 91분입니다. 야간 사용의 50.0%입니다.',
  };
  expect(toFact(night)).toBe('취침 전후로 가장 오래 사용한 앱은 {앱}이고 91분입니다. 야간 사용의 50.0%입니다.');
  const decreased = { code: 'SELECTED_USAGE_DECREASED', evidence: {}, text: '전주 대비 주간 합계가 94분 줄었습니다.' };
  expect(toFact(decreased)).toBe(decreased.text);
});

test('주 시작일 → epoch day (같은 주는 같은 시드)', () => {
  expect(weekSeed('1970-01-02')).toBe(1);
  expect(weekSeed('2026-09-14')).toBe(20710);
});
