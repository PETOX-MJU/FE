type AnalysisDay = {
  date: string;
  selected_ms: number | null;
};

type AnalysisApp = {
  package_name: string;
  is_target: boolean;
  total_ms: number | null;
  delta_ms: number | null;
};

type AnalysisOutput = {
  insights: Array<{ code: string; text: string }>;
  metrics: {
    selected_total_ms: number | null;
    per_day: AnalysisDay[];
    previous_per_day: AnalysisDay[];
    per_app: AnalysisApp[];
    comparison: { selected_delta_ms: number | null };
  };
};

// dashboard-api-spec.md 3.4 DashboardUiState 중 화면이 쓰는 부분
type DashboardInput = {
  analysis: AnalysisOutput;
};

const APP_META: Record<string, { name: string; color: string; initial: string }> = {
  'com.google.android.youtube': { name: 'YouTube', color: '#FF4D4D', initial: 'Y' },
  'com.instagram.android': { name: 'Instagram', color: '#D86DEB', initial: 'I' },
  'com.zhiliaoapp.musically': { name: 'TikTok', color: '#171717', initial: 'T' },
};

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export function formatDuration(ms: number): string {
  const totalMinutes = Math.round(Math.abs(ms) / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!hours) return `${minutes}분`;
  if (!minutes) return `${hours}시간`;
  return `${hours}시간 ${minutes}분`;
}

function formatDelta(ms: number | null): string {
  if (ms === null || ms === 0) return '– 변동 없음';
  return `${ms < 0 ? '▼' : '▲'} ${formatDuration(ms)}`;
}

function dayModel(day: AnalysisDay) {
  const date = new Date(`${day.date}T00:00:00Z`);
  return {
    date: day.date,
    label: WEEKDAYS[date.getUTCDay()],
    minutes: Math.round((day.selected_ms ?? 0) / 60_000),
  };
}

// Android 는 한글을 글자 단위로 줄바꿈해서 "입니 / 다" 처럼 끊긴다.
// 어절 안의 글자 사이에 WORD JOINER(U+2060)를 넣어 띄어쓰기에서만 줄이 바뀌게 한다.
export function keepWords(text: string): string {
  return text
    .split(' ')
    .map(word => Array.from(word).join('\u2060'))
    .join(' ');
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function localDateKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** 해당 월 달력. 일요일 시작, 앞쪽 빈칸은 null. */
export function monthCalendar(today: Date, attended: string[]) {
  const year = today.getFullYear();
  const month = today.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const leading = new Date(year, month, 1).getDay();
  const days = Array.from({ length: lastDay }, (_, index) => {
    const key = localDateKey(new Date(year, month, index + 1));
    return { key, day: index + 1, attended: attended.includes(key) };
  });
  return { monthName: MONTHS[month], cells: [...Array(leading).fill(null), ...days] as Array<(typeof days)[number] | null> };
}

export type MissionStatus = 'in_progress' | 'completed' | 'failed';

/** Supabase user_missions + missions 조회 결과 한 행 */
export type MissionRow = { id: string; status: MissionStatus; missions: { title: string } | null };

export function toMissionCards(rows: MissionRow[]) {
  return rows
    .filter(row => row.missions)
    .map(row => ({ id: row.id, title: keepWords(row.missions!.title), status: row.status }));
}

function shortDate(value: string): string {
  const [, month, day] = value.split('-').map(Number);
  return `${month}월 ${day}일`;
}

export function toDashboardModel(input: DashboardInput) {
  const output = input.analysis;
  const currentDays = output.metrics.per_day.map(dayModel);
  const previousDays = output.metrics.previous_per_day.map(dayModel);
  const deltaMs = output.metrics.comparison.selected_delta_ms;

  return {
    totalLabel: formatDuration(output.metrics.selected_total_ms ?? 0),
    deltaLabel: formatDelta(deltaMs),
    improved: deltaMs !== null && deltaMs < 0,
    // 명세 4.6: insights[0].text 를 그대로 쓰고, 비어 있으면 요약을 숨긴다.
    summary: output.insights[0] ? keepWords(output.insights[0].text) : null,
    periodLabel:
      currentDays.length > 0
        ? `${shortDate(currentDays[0].date)} ~ ${shortDate(currentDays[currentDays.length - 1].date)}`
        : '',
    currentDays,
    previousDays,
    apps: output.metrics.per_app
      .filter(app => app.is_target)
      .map(app => {
        const meta = APP_META[app.package_name] ?? {
          name: app.package_name,
          color: '#777777',
          initial: app.package_name.slice(0, 1).toUpperCase(),
        };
        return {
          ...meta,
          packageName: app.package_name,
          usageLabel: formatDuration(app.total_ms ?? 0),
          deltaLabel: formatDelta(app.delta_ms),
          improved: app.delta_ms !== null && app.delta_ms < 0,
        };
      }),
  };
}

export type DashboardModel = ReturnType<typeof toDashboardModel>;
