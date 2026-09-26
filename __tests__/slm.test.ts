const FACT = '지난주 선택한 앱 사용량은 하루 평균 38분입니다. 전주 대비 주간 합계가 29분 줄었습니다. 변화율은 9.8%입니다.';
const NIGHT = '취침 전후로 가장 오래 사용한 앱은 {앱}이고 32분입니다.';

function fakeContext(content: string, delayMs = 0) {
  return {
    completion: jest.fn(() => new Promise(r => setTimeout(() => r({ content, timings: { predicted_per_second: 20 } }), delayMs))),
    stopCompletion: jest.fn(async () => {}),
    release: jest.fn(async () => {}),
  };
}

// 모듈 안의 메모·대기열을 테스트마다 비운다. resetModules 뒤에는 llama.rn 목도 새 인스턴스라 다시 require 한다.
let rewriteSummary: typeof import('../src/features/screentime/slm').rewriteSummary;
let init: jest.Mock;
beforeEach(() => {
  jest.resetModules();
  init = require('llama.rn').initLlama;
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  ({ rewriteSummary } = require('../src/features/screentime/slm'));
});
afterEach(() => jest.useRealTimers());

test('검사를 통과하면 앱 이름을 채워 돌려주고 모델을 해제한다', async () => {
  const ctx = fakeContext('밤 시간엔 {앱:을} 32분 봤어요.');
  init.mockResolvedValue(ctx);
  await expect(rewriteSummary(NIGHT, 'TikTok', 1)).resolves.toBe('밤 시간엔 TikTok을 32분 봤어요.');
  expect(ctx.completion).toHaveBeenCalledWith(expect.objectContaining({
    jinja: true, enable_thinking: false, n_predict: 80, temperature: 0.5, seed: 1,
  }));
  expect(ctx.release).toHaveBeenCalled();
});

test('검사에 걸리면 null (숫자가 사실에 없음)', async () => {
  init.mockResolvedValue(fakeContext('그 전주보다 30분 줄였어요!'));
  await expect(rewriteSummary(FACT, 'YouTube', 1)).resolves.toBeNull();
});

test('모델 파일이 없으면(초기화 실패) null', async () => {
  init.mockRejectedValue(new Error('failed to load model'));
  await expect(rewriteSummary(FACT, 'YouTube', 1)).resolves.toBeNull();
});

test('15초가 지나면 null, 생성을 멈추고 해제한다', async () => {
  jest.useFakeTimers();
  const ctx = fakeContext('그 전주보다 29분 줄였어요!', 60_000);
  init.mockResolvedValue(ctx);
  const result = rewriteSummary(FACT, 'YouTube', 1);
  await jest.advanceTimersByTimeAsync(15_000);
  await jest.advanceTimersByTimeAsync(60_000);
  await expect(result).resolves.toBeNull();
  expect(ctx.stopCompletion).toHaveBeenCalled();
  expect(ctx.release).toHaveBeenCalled();
});

test('불러오는 중 시간 초과여도 적재가 끝나면 해제한다', async () => {
  jest.useFakeTimers();
  const ctx = fakeContext('그 전주보다 29분 줄였어요!');
  init.mockImplementation(() => new Promise(r => setTimeout(() => r(ctx), 20_000)));
  const result = rewriteSummary(FACT, 'YouTube', 1);
  await jest.advanceTimersByTimeAsync(25_000);
  await expect(result).resolves.toBeNull();
  expect(ctx.release).toHaveBeenCalled();
});

test('겹친 호출도 모델은 한 번에 하나만 올린다', async () => {
  let live = 0;
  let peak = 0;
  init.mockImplementation(async () => {
    peak = Math.max(peak, ++live);
    const ctx = fakeContext('그 전주보다 29분 줄였어요!', 10);
    ctx.release.mockImplementation(async () => { live--; });
    return ctx;
  });
  await Promise.all([rewriteSummary(FACT, 'YouTube', 1), rewriteSummary(FACT, 'YouTube', 2)]);
  expect(peak).toBe(1);
});

test('같은 사실·시드는 다시 생성하지 않는다 (앱 복귀 때마다 재분석)', async () => {
  init.mockResolvedValue(fakeContext('그 전주보다 29분 줄였어요!'));
  await rewriteSummary(FACT, 'YouTube', 1);
  await rewriteSummary(FACT, 'YouTube', 1);
  expect(init).toHaveBeenCalledTimes(1);
});
