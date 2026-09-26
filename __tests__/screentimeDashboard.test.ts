import preview from './fixtures/screentimePreview.json';
import { appName, keepWords, monthCalendar, summaryTitle, toDashboardModel, toMissionCards } from '../src/features/screentime/dashboard';
import { DEFAULT_SETTINGS, mergeSettings } from '../src/features/screentime/onDevice';

test('derives dashboard values from analysis output', () => {
  const dashboard = toDashboardModel(preview);

  expect(dashboard.totalLabel).toBe('17시간 44분');
  expect(dashboard.deltaLabel).toBe('▼ 1시간 34분');
  expect(dashboard.summary?.replace(/⁠/g, '')).toBe(preview.analysis.insights[0].text);
  expect(dashboard.currentDays).toHaveLength(7);
  expect(dashboard.previousDays).toHaveLength(7);
  expect(dashboard.apps.map(app => [app.name, app.deltaLabel])).toEqual([
    ['YouTube', '▼ 1시간 25분'],
    ['Instagram', '▼ 36분'],
    ['TikTok', '▲ 27분'],
  ]);
});

test('keeps Korean words together so lines only break at spaces', () => {
  expect(keepWords('줄었습니다. 변화율은')).toBe('줄⁠었⁠습⁠니⁠다⁠. 변⁠화⁠율⁠은');
});

test('builds a Sunday-first month calendar with attended days', () => {
  const calendar = monthCalendar(new Date(2026, 8, 23), ['2026-09-19', '2026-09-20']);

  expect(calendar.monthName).toBe('September');
  expect(calendar.cells.slice(0, 2)).toEqual([null, null]); // 2026-09-01 은 화요일
  expect(calendar.cells.filter(cell => cell?.attended).map(cell => cell?.day)).toEqual([19, 20]);
  expect(calendar.cells).toHaveLength(2 + 30);
});

test('maps server mission rows to cards and skips rows without a mission', () => {
  const cards = toMissionCards([
    { id: 'a', status: 'completed', missions: { title: '오늘 펫 2회 이하로 보기' } },
    { id: 'b', status: 'in_progress', missions: null },
  ]);

  expect(cards).toEqual([{ id: 'a', title: keepWords('오늘 펫 2회 이하로 보기'), status: 'completed' }]);
});

test('unknown days and totals stay unknown instead of becoming 0', () => {
  const analysis = JSON.parse(JSON.stringify(preview.analysis)) as typeof preview.analysis;
  (analysis.metrics.per_day[6] as { selected_ms: number | null }).selected_ms = null;
  (analysis.metrics as { selected_total_ms: number | null }).selected_total_ms = null;

  const dashboard = toDashboardModel({ analysis });

  expect(dashboard.currentDays[6].minutes).toBeNull();
  expect(dashboard.totalLabel).toBe('확인 불가');
});

test('analysis settings take BE values and fall back to defaults', () => {
  expect(mergeSettings({ goal_minutes: 90, bedtime: '23:30:00' }, ['com.instagram.android'])).toEqual({
    ...DEFAULT_SETTINGS,
    targetPackages: ['com.instagram.android'],
    weekdayBed: '23:30',
    weekendBed: '23:30',
    dailyTargetMinutes: 90,
  });
  expect(mergeSettings(null, [])).toEqual(DEFAULT_SETTINGS);
});

test('missing comparison week reads as not comparable, not as no change', () => {
  const analysis = JSON.parse(JSON.stringify(preview.analysis)) as typeof preview.analysis;
  (analysis.metrics.comparison as { selected_delta_ms: number | null }).selected_delta_ms = null;

  expect(toDashboardModel({ analysis })).toMatchObject({ deltaLabel: '비교할 기록 부족', deltaTone: 'neutral' });
});

test('한줄 요약 제목에 반려견 이름을 단다', () => {
  expect(summaryTitle('초코')).toBe('초코의 한줄 요약');
  expect(summaryTitle('  ')).toBe('한줄 요약');
  expect(summaryTitle(null)).toBe('한줄 요약');
  expect(summaryTitle('가나다라마바사아자')).toBe('가나다라마바사아…의 한줄 요약');
});

test('앱 표시명은 APP_META 이름, 없으면 패키지명', () => {
  expect(appName('com.zhiliaoapp.musically')).toBe('TikTok');
  expect(appName('com.example.unknown')).toBe('com.example.unknown');
});

test('SLM 입력으로 첫 insight 와 주 시작일을 넘긴다', () => {
  const dashboard = toDashboardModel(preview);
  expect(dashboard.insight?.code).toBe('SELECTED_USAGE_DECREASED');
  expect(dashboard.weekStart).toBe('2026-09-14');
});
