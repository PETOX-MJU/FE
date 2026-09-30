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

// 분석기 evidence → 수치 줄. 기대값은 Python data.fact_* (학습 입력) — export_cases.py 의 facts.
test.each(cases.facts.map((c, i) => [i, c.code, c]))('Python 과 같은 수치 줄 #%d %s', (_i, _code, c) => {
  expect(toFact(c as Parameters<typeof toFact>[0])).toBe(c.fact);
});

test('toFact: 패키지명은 줄에 들어가지 않고 {앱} 으로 쓴다', () => {
  const fact = toFact({
    code: 'NIGHT_TOP_APP',
    evidence: { package_name: 'com.google.android.youtube', night_total_ms: 91 * 60_000, night_share_pct: 50 },
    text: '취침 전후로 가장 오래 사용한 앱은 com.google.android.youtube이고 91분입니다. 야간 사용의 50.0%입니다.',
  });
  expect(fact).toBe('종류: 야간 최다 사용 앱\n앱: {앱}\n야간 사용: 91분\n야간 비중: 50.0%');
  expect(fact).not.toContain('youtube');
});

test('주 시작일 → epoch day (같은 주는 같은 시드)', () => {
  expect(weekSeed('1970-01-02')).toBe(1);
  expect(weekSeed('2026-09-14')).toBe(20710);
});
