import { buildUsageRows, localDate } from '../src/features/screentime/sync';

const APPS = [
  { id: 'yt', package_name: 'com.google.android.youtube' },
  { id: 'tt', package_name: 'com.zhiliaoapp.musically' },
];
const TODAY = '2026-09-25';
const YESTERDAY = '2026-09-24';
const MIN = 60_000;

test('기록이 있는 날은 추적 앱마다 한 줄, 안 쓴 앱은 0분', () => {
  const rows = buildUsageRows(
    [{ date: TODAY, quality: 'partial', apps: [{ package_name: 'com.google.android.youtube', duration_ms: 42 * MIN }] }],
    APPS,
    'u1',
    TODAY,
    YESTERDAY,
  );
  expect(rows).toEqual([
    { user_id: 'u1', app_id: 'yt', usage_date: TODAY, minutes: 42 },
    { user_id: 'u1', app_id: 'tt', usage_date: TODAY, minutes: 0 },
  ]);
});

test('기록이 없는 날(unavailable)은 0분으로 꾸미지 않고 건너뛴다', () => {
  const rows = buildUsageRows([{ date: YESTERDAY, quality: 'unavailable', apps: null }], APPS, 'u1', TODAY, YESTERDAY);
  expect(rows).toEqual([]);
});

test('오늘·어제가 아닌 날은 complete 일 때만 올린다', () => {
  const rows = buildUsageRows(
    [
      { date: '2026-09-20', quality: 'partial', apps: [] },
      { date: '2026-09-21', quality: 'complete', apps: [] },
      { date: YESTERDAY, quality: 'partial', apps: [] },
    ],
    APPS,
    'u1',
    TODAY,
    YESTERDAY,
  );
  expect([...new Set(rows.map(r => r.usage_date))]).toEqual(['2026-09-21', YESTERDAY]);
});

test('틱톡 지역판 패키지는 틱톡 행에 합친다', () => {
  const rows = buildUsageRows(
    [
      {
        date: TODAY,
        quality: 'partial',
        apps: [
          { package_name: 'com.zhiliaoapp.musically', duration_ms: 10 * MIN },
          { package_name: 'com.ss.android.ugc.trill', duration_ms: 5 * MIN },
        ],
      },
    ],
    APPS,
    'u1',
    TODAY,
    YESTERDAY,
  );
  expect(rows.find(r => r.app_id === 'tt')?.minutes).toBe(15);
});

test('기기 시간대 날짜 문자열', () => {
  expect(localDate(new Date(2026, 8, 5))).toBe('2026-09-05');
});
