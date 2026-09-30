/**
 * 한줄 요약 SLM 출력 검사와 앱 이름 채우기. 네이티브 의존 없는 순수 함수만 둔다.
 *
 * 정본은 AI 저장소 Python 이다: slm_summary/bench.py(check, meaning_errors), data.py(marker_errors, fill, has_batchim).
 * 규칙을 바꿀 때는 Python 을 먼저 고치고 export_cases.py 로 __tests__/fixtures/slmCases.json 을 다시 만든다.
 */

/** 학습 때와 한 글자도 다르면 안 된다 (slm_summary/data.py SYSTEM). */
export const SYSTEM =
  '주간 스크린타임 수치를 펫 캐릭터의 다정한 존댓말 한 문장으로 써라. 숫자와 {앱} 표시는 그대로 옮기고 수치에 없는 말은 하지 마라.';
export const APP = '{앱}';

const JOSA: Record<string, [string, string]> = {
  을: ['을', '를'],
  이: ['이', '가'],
  은: ['은', '는'],
  과: ['과', '와'],
  이었: ['이었', '였'],
  이에: ['이에', '예'],
};
const marker = () => /\{앱(?::(을|이|은|과|이었|이에))?\}/g;
const LETTER_BATCHIM = 'lmnr013678'; // 약어·숫자는 글자 이름으로 읽는다 (구=9 는 받침 없음)

export function hasBatchim(word: string): boolean {
  const w = word.trim();
  const ch = w.slice(-1);
  if (ch >= '가' && ch <= '힣') return (ch.charCodeAt(0) - 0xac00) % 28 !== 0;
  const tail = w.slice(-2);
  const upper = tail === tail.toUpperCase() && tail !== tail.toLowerCase(); // Python str.isupper()
  if (upper || w.length === 1 || /\d/.test(ch)) return LETTER_BATCHIM.includes(ch.toLowerCase());
  return w.toLowerCase().endsWith('ng') || 'lmnrkpt'.includes(ch.toLowerCase());
}

/** `{앱:을}` → "TikTok을". 화면에 보여 주기 직전에 부른다. */
export function fill(text: string, app: string): string {
  return text.replace(marker(), (_m, josa?: string) => {
    if (!josa) return app;
    const [withB, withoutB] = JOSA[josa];
    return app + (hasBatchim(app) ? withB : withoutB);
  });
}

const NUM = /\d+(?:\.\d+)?/g;
const BANNED = /중독|우울|불안|의지|게으|한심|실패자|잠든|수면/;

/** bench.check — 걸린 항목 이름을 Python 딕셔너리 순서대로. */
function check(fact: string, out: string): string[] {
  const factNums = new Set(fact.match(NUM) ?? []);
  const body = out.trim();
  const flags: Array<[string, boolean]> = [
    ['빈 출력', !body],
    ['숫자 오류', (body.match(NUM) ?? []).some(n => !factNums.has(n))],
    ['여러 문장', body.includes('\n') || (body.match(/[.!?](?=\s|$)/g) ?? []).length > 1],
    ['너무 김', Array.from(body).length > 90], // Python len 은 코드 포인트 수
    // 한자·가나는 늘 오류. 로마자는 사실에 나온 것만 허용
    ['외국 문자', /[一-鿿぀-ヿ]/.test(body) || (body.match(/[A-Za-z]+/g) ?? []).some(w => !fact.includes(w))],
    ['금지어', BANNED.test(body)],
  ];
  return flags.filter(([, bad]) => bad).map(([name]) => name);
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** bench.meaning_errors — 단위·방향까지 본다. 숫자는 앞뒤가 숫자가 아닐 때만 같은 숫자로 본다. */
function meaningErrors(fact: string, out: string): string[] {
  const body = out.replace(/(\d)\s+(분|개|일|%)/g, '$1$2');
  const at = (token: string) => {
    const m = new RegExp('(?<![\\d.])' + escapeRe(token)).exec(fact);
    return m ? { start: m.index, end: m.index + m[0].length } : null;
  };
  const errs: string[] = [];
  for (const [, n, unit] of body.matchAll(/(?<![\d.])(\d+(?:\.\d+)?)(분|%)/g)) {
    if (!at(`${n}${unit}`)) errs.push(`${n}${unit} 없음`);
  }
  for (const [, e, s] of body.matchAll(/(?<![\d.])(\d+)개 중 (\d+)개/g)) {
    if (!at(`${e}개 중 ${s}개`)) errs.push(`${e}개 중 ${s}개 없음`);
  }
  // 숫자가 적힌 줄 전체 — 수치 줄의 라벨(주간 감소량·다른 앱 증가량)이 그 숫자의 방향이다.
  const lineOf = (hit: { start: number; end: number }) => {
    const from = hit.start === 0 ? 0 : fact.lastIndexOf('\n', hit.start - 1) + 1;
    const to = fact.indexOf('\n', hit.end);
    return fact.slice(from, to === -1 ? undefined : to);
  };
  for (const m of body.matchAll(/(?<![\d.])(\d+(?:\.\d+)?)(분|%)?[^,.]{0,12}?(늘|증가|많아)/g)) {
    const hit = at(`${m[1]}${m[2] ?? ''}`);
    if (hit && !lineOf(hit).includes('증가')) errs.push(`${m[1]} 방향(늘) 틀림`);
  }
  for (const m of body.matchAll(/(?<![\d.])(\d+(?:\.\d+)?)(분|%)?[^,.]{0,12}?(줄|감소)/g)) {
    const hit = at(`${m[1]}${m[2] ?? ''}`);
    if (hit && !lineOf(hit).includes('감소')) errs.push(`${m[1]} 방향(줄) 틀림`);
  }
  const allDone = Array.from(fact.matchAll(/(\d+)개 중 (\d+)개/g)).some(([, a, b]) => a === b);
  if (/모두 (달성|완료)|다 달성/.test(body) && !allDone) errs.push('모두 달성 아님');
  errs.push(...missionClaimErrors(fact, body));
  return errs;
}

const ALL_CLAIM = /모두 (해냈|달성|성공)|전부 성공|다 해냈/;
const NONE_CLAIM = /하나도 못|못 채웠|모두 아쉬웠/;

/** bench.mission_claim_errors — 절마다 "모두 해냈다"·"하나도 못했다" 같은 판정 말이 사실과 맞는지 본다. */
function missionClaimErrors(fact: string, body: string): string[] {
  const pairs: Record<string, [number, number]> = {};
  for (const [, kind, e, s] of fact.matchAll(/(일일|야간) (?:미션(?:은|:) )?(\d+)개 중 (\d+)개/g)) pairs[kind] = [Number(e), Number(s)];
  const errs: string[] = [];
  let pending = '';
  for (const part of body.split(/[,.!]/)) {
    // 서술어 없는 쉼표 조각("일일 3개, 야간 3개 미션을 …")은 뒤 조각과 한 절이다
    const clause = pending + part;
    pending = '';
    if (!/(요|다)\s*$/.test(clause.trim())) {
      pending = clause;
      continue;
    }
    const all = ALL_CLAIM.test(clause);
    const none = NONE_CLAIM.test(clause);
    if (!all && !none) continue;
    const named = ['일일', '야간'].filter(k => clause.includes(k));
    for (const kind of named.length ? named : ['일일', '야간']) {
      const [e, s] = pairs[kind] ?? [0, -1];
      if (all && !(e > 0 && s === e)) errs.push(`${kind} 전부 달성 아님`);
      if (none && !(e > 0 && s === 0)) errs.push(`${kind} 0개 아님`);
    }
  }
  return errs;
}

/** data.marker_errors — `{앱}` 이 사실에 있으면 정확히 한 번, 없으면 0번. 그 밖의 중괄호는 오류. */
function markerErrors(fact: string, out: string): string[] {
  const want = fact.includes(APP) ? 1 : 0;
  const got = (out.match(marker()) ?? []).length;
  const errs = got === want ? [] : [`앱 표시 ${got}회(기대 ${want})`];
  const rest = out.replace(marker(), '');
  if (rest.includes('{') || rest.includes('}')) errs.push('잘못된 자리표시');
  return errs;
}

/** 걸린 검사 이름들. 빈 배열이어야 화면에 쓴다 (eval_ft.py 의 fail 과 같은 순서). */
export function failures(fact: string, out: string): string[] {
  return [...check(fact, out), ...meaningErrors(fact, out), ...markerErrors(fact, out)];
}

const PURPOSES = ['학습', '업무', '여가', '연락', '기타'];
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const minutes = (ms: unknown) => {
  const v = num(ms);
  return v === null ? null : Math.round(Math.abs(v) / 60_000);
};
const percent = (v: unknown) => {
  const n = num(v);
  return n === null ? null : `${Math.abs(n).toFixed(1)}%`;
};
const missions = (success: unknown, evaluable: unknown) =>
  num(evaluable) === 0 ? '판정 가능한 미션 없음' : `${evaluable}개 중 ${success}개 달성`;

type Insight = { code: string; text: string; evidence: Record<string, unknown> };

/** 종류별 수치 줄. 줄 모양은 AI 저장소 slm_summary/data.py 의 fact_* 와 같아야 한다 (학습 입력). */
function factLines({ code, text, evidence: ev }: Insight): string[] | null {
  switch (code) {
    case 'SELECTED_USAGE_DECREASED': {
      const delta = num(ev.selected_delta_ms);
      if (delta === null || delta >= 0) return null;
      const mean = minutes(ev.selected_daily_mean_ms);
      const pct = percent(ev.selected_delta_pct);
      return [
        '종류: 관리 앱 사용 감소',
        ...(mean === null ? [] : [`하루 평균: ${mean}분`]),
        `주간 감소량: ${minutes(delta)}분`,
        ...(pct === null ? [] : [`감소율: ${pct}`]),
      ];
    }
    case 'OTHER_APPS_INCREASED': {
      const other = num(ev.other_apps_delta_ms);
      return other === null || other <= 0 ? null : ['종류: 관리 앱 감소, 다른 앱 증가', `다른 앱 증가량: ${minutes(other)}분`];
    }
    case 'NIGHT_TOP_APP': {
      const mins = minutes(ev.night_total_ms);
      if (mins === null) return null;
      const share = percent(ev.night_share_pct);
      // 사용 목적은 evidence 에 없고 분석기 문장에만 있다
      const purpose = /사용 목적은 '([^']+)'/.exec(text)?.[1];
      return [
        '종류: 야간 최다 사용 앱',
        `앱: ${APP}`,
        `야간 사용: ${mins}분`,
        ...(share === null ? [] : [`야간 비중: ${share}`]),
        ...(purpose && PURPOSES.includes(purpose) ? [`사용 목적: ${purpose}`] : []),
      ];
    }
    case 'DAILY_NIGHT_DIFFERENCE':
      if ([ev.daily_success_count, ev.daily_evaluable_count, ev.night_success_count, ev.night_evaluable_count].some(v => num(v) === null)) return null;
      return [
        '종류: 미션 결과',
        `일일 미션: ${missions(ev.daily_success_count, ev.daily_evaluable_count)}`,
        `야간 미션: ${missions(ev.night_success_count, ev.night_evaluable_count)}`,
      ];
    case 'INSUFFICIENT_DATA':
      if (num(ev.valid_days) === null || num(ev.valid_nights) === null) return null;
      return [
        '종류: 기록 부족',
        `확인된 날: ${ev.valid_days}일`,
        `확인된 야간 구간: ${ev.valid_nights}개`,
        '필요한 기록: 각각 7개',
        `목표: ${ev.has_active_target ? '기존 목표 유지' : '임시 목표 사용'}`,
      ];
    default:
      return null;
  }
}

/**
 * 분석기 인사이트 → 모델에 줄 수치 줄. 문장은 주지 않는다 — 분석기 문장의 어순에 끌려가지 않게.
 * 앱 이름(패키지명)도 넣지 않고 `{앱}` 으로 쓴다. 만들 수 없거나 줄의 숫자가 분석기 문장과 다르면 null —
 * 반올림이 어긋난 것이라 화면의 템플릿 문장과 다른 숫자가 나오므로 템플릿을 그대로 쓴다.
 */
export function toFact(insight: Insight): string | null {
  const lines = factLines(insight);
  if (!lines) return null;
  const fact = lines.join('\n');
  const shown = new Set(insight.text.match(NUM) ?? []);
  return (fact.match(NUM) ?? []).every(n => shown.has(n)) ? fact : null;
}

/** 리포트 주 시작일 → epoch day. 생성 시드로 써서 같은 주는 같은 문장이 나오게 한다. */
export function weekSeed(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
}
