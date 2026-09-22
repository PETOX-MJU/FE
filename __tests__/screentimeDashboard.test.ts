import preview from '../src/data/screentimePreview.json';
import { keepWords, monthCalendar, toDashboardModel, toMissionCards } from '../src/features/screentime/dashboard';

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
