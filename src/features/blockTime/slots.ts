import { BLOCK_SLOTS } from '@/constants/onboardingStrings';

// 숏폼 방지 시간대 계산. 시간대는 추천 id('bedtime' 등) 또는 직접 고른 "HH:00~HH:00".
// 끝이 시작보다 이르면 자정을 넘긴 구간이다 (예: 23:00~02:00).

/** "22:00~01:00", "19:00 ~ 21:00" → [시작시, 끝시]. 못 읽으면 null */
function parseRange(range: string): [number, number] | null {
  const m = range.match(/(\d{1,2}):\d{2}\s*~\s*(\d{1,2}):\d{2}/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2])];
}

function rangeOf(slot: string): string {
  return BLOCK_SLOTS.find(s => s.id === slot)?.range ?? slot;
}

/** 시간대가 덮는 시(0~23) 목록. 칸 h = h:00~h+1:00 */
export function slotHours(slot: string): number[] {
  const r = parseRange(rangeOf(slot));
  if (!r) return [];
  const [s, e] = r;
  const end = e % 24;
  const hours: number[] = [];
  for (let h = s % 24; hours.length < 24; h = (h + 1) % 24) {
    if (hours.length > 0 && h === end) break;
    hours.push(h);
  }
  return hours;
}

/** 화면에 보일 이름 — 추천은 "취침 전", 직접 고른 건 구간 그대로 */
export function slotLabel(slot: string): string {
  return BLOCK_SLOTS.find(s => s.id === slot)?.label ?? slot;
}

/** 새 구간과 겹치는 기존 시간대들 */
export function overlapping(range: string, existing: string[]): string[] {
  const mine = new Set(slotHours(range));
  return existing.filter(s => slotHours(s).some(h => mine.has(h)));
}

/** 새 구간이 기존 시간대들 안에 전부 들어가는가 (추가해도 달라지는 게 없음) */
export function fullyCovered(range: string, existing: string[]): boolean {
  const covered = new Set(existing.flatMap(slotHours));
  const mine = slotHours(range);
  return mine.length > 0 && mine.every(h => covered.has(h));
}

/**
 * 시간대를 목록에 더한다. 새 구간 안에 통째로 들어가는 기존 시간대는 뺀다(의미가 없어서).
 * removed: 빠진 시간대 — 화면에서 알려 준다.
 */
export function addSlot(
  list: string[],
  slot: string,
): { list: string[]; removed: string[] } {
  if (list.includes(slot)) return { list, removed: [] };
  const mine = new Set(slotHours(slot));
  const removed = list.filter(
    s => slotHours(s).length > 0 && slotHours(s).every(h => mine.has(h)),
  );
  return { list: [...list.filter(s => !removed.includes(s)), slot], removed };
}

/** "HH:00~HH:00" → { start, end } (끝 24 = 자정). 못 읽으면 null */
export function rangeHours(
  range: string,
): { start: number; end: number } | null {
  const r = parseRange(range);
  if (!r) return null;
  return { start: r[0] % 24, end: r[1] === 0 ? 24 : r[1] };
}
