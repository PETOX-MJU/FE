/**
 * 한줄 요약 SLM 출력 검사와 앱 이름 채우기. 네이티브 의존 없는 순수 함수만 둔다.
 *
 * 정본은 AI 저장소 Python 이다: slm_summary/bench.py(check, meaning_errors), data.py(marker_errors, fill, has_batchim).
 * 규칙을 바꿀 때는 Python 을 먼저 고치고 export_cases.py 로 __tests__/fixtures/slmCases.json 을 다시 만든다.
 */

/** 학습 때와 한 글자도 다르면 안 된다 (slm_summary/data.py SYSTEM). */
export const SYSTEM =
  '주간 스크린타임 사실 하나를 펫 캐릭터의 다정한 존댓말 한 문장으로 바꿔라. 숫자와 {앱} 표시는 그대로 옮기고 사실에 없는 말은 하지 마라.';
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
  for (const m of body.matchAll(/(?<![\d.])(\d+(?:\.\d+)?)(분|%)?[^,.]{0,12}?(늘|증가|많아)/g)) {
    const hit = at(`${m[1]}${m[2] ?? ''}`);
    if (hit && !fact.slice(hit.end, hit.end + 40).includes('늘었')) errs.push(`${m[1]} 방향(늘) 틀림`);
  }
  for (const m of body.matchAll(/(?<![\d.])(\d+(?:\.\d+)?)(분|%)?[^,.]{0,12}?(줄|감소)/g)) {
    const hit = at(`${m[1]}${m[2] ?? ''}`);
    if (hit && !/줄었|변화율/.test(fact.slice(Math.max(0, hit.start - 25), hit.end + 25))) {
      errs.push(`${m[1]} 방향(줄) 틀림`);
    }
  }
  const allDone = Array.from(fact.matchAll(/(\d+)개 중 (\d+)개/g)).some(([, a, b]) => a === b);
  if (/모두 (달성|완료)|다 달성/.test(body) && !allDone) errs.push('모두 달성 아님');
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

/** 분석기 문장 → 모델에 줄 사실. 분석기는 패키지명을 문장에 넣고, 모델은 `{앱}` 으로 학습했다. */
export function toFact(insight: { code: string; text: string; evidence: Record<string, unknown> }): string {
  const pkg = insight.evidence.package_name;
  return insight.code === 'NIGHT_TOP_APP' && typeof pkg === 'string' ? insight.text.split(pkg).join(APP) : insight.text;
}

/** 리포트 주 시작일 → epoch day. 생성 시드로 써서 같은 주는 같은 문장이 나오게 한다. */
export function weekSeed(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
}
