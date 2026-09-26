import { initLlama, type LlamaContext } from 'llama.rn';
import { SYSTEM, failures, fill } from '@/features/screentime/slmCheck';

// ponytail: 시연용 고정 경로 — adb 로 넣는다(AI 저장소 slm_summary/README). 배포 때는 모델 다운로드로 바꾼다.
const MODEL_PATH = 'file:///data/data/com.petoxmju.petox/files/ft-v2-q4.gguf';
const TIMEOUT_MS = 15_000;

let queue: Promise<unknown> = Promise.resolve();
let last: { key: string; out: string | null } | null = null;

// 실기기에서 stopCompletion/release 가 프라미스가 아닌 값을 돌려주거나 동기적으로 던지는 걸 봤다.
// 정리는 항상 시도해야 한다 — 무엇을 돌려주든 삼킨다.
async function quietly(f: () => unknown): Promise<void> {
  try {
    await f();
  } catch {
    // 정리 실패는 무시 — release 를 못 불러도 다음 단계(work 대기, 마지막 release)는 계속한다.
  }
}

/**
 * 분석기 사실 하나를 반려견 말투 한 문장으로. 검사를 통과해 앱 이름까지 채운 문장, 아니면 null.
 * null 이면 호출하는 쪽이 템플릿 문장을 그대로 쓴다.
 *
 * 모델은 1GB 가까이 메모리를 쓴다. 호출을 줄 세워 동시에 두 개를 올리지 않고,
 * 대시보드가 앱 복귀 때마다 다시 분석해도 같은 사실·시드면 지난 결과를 쓴다.
 */
export function rewriteSummary(fact: string, app: string, seed: number): Promise<string | null> {
  const key = `${seed}\n${fact}`;
  const run = async () => {
    if (last?.key !== key) last = { key, out: await generate(fact, seed) };
    return last.out === null ? null : fill(last.out, app);
  };
  const result = queue.then(run, run);
  queue = result.catch(() => {});
  return result;
}

async function generate(fact: string, seed: number): Promise<string | null> {
  const started = Date.now();
  const held: { ctx?: LlamaContext } = {};
  let timedOut = false;
  const work = (async () => {
    held.ctx = await initLlama({ model: MODEL_PATH, n_ctx: 512, n_threads: 4, n_gpu_layers: 0, use_mlock: false });
    if (timedOut) return null; // 적재만 늦었을 뿐 이미 시간 초과 처리됨 — 생성은 돌리지 않는다.
    const loadedMs = Date.now() - started;
    const result = await held.ctx.completion({
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: `사실: ${fact}` },
      ],
      jinja: true,
      enable_thinking: false,
      n_predict: 80,
      temperature: 0.5,
      seed,
    });
    return { result, loadedMs };
  })();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>(resolve => {
    timer = setTimeout(() => { timedOut = true; resolve(null); }, TIMEOUT_MS);
  });
  try {
    const done = await Promise.race([work, timeout]);
    if (done === null) {
      console.warn('[slm] 15초 초과, 템플릿 사용');
      return null;
    }
    // llama-server 는 사고 과정을 message.content 에서 걸러내지만, 빈 <think></think> 껍데기는 남을 수 있다.
    const out = done.result.content.replace(/^\s*<think>[\s\S]*?<\/think>\s*/, '').trim();
    const errs = failures(fact, out);
    // 시연 중 logcat(ReactNativeJS)으로 속도·판정을 본다
    const line = `[slm] 적재 ${done.loadedMs}ms, 전체 ${Date.now() - started}ms, ${done.result.timings.predicted_per_second.toFixed(1)} tok/s`;
    if (errs.length) {
      console.warn(line, `검사 실패 ${errs.join(', ')}`, out);
      return null;
    }
    console.log(line, '통과', out);
    return out;
  } catch (e) {
    console.warn('[slm] 템플릿 사용:', e instanceof Error ? e.message : e);
    return null;
  } finally {
    clearTimeout(timer);
    // 시간 초과면 생성을 멈추고, 적재 중이었다면 끝날 때까지 기다렸다가 해제한다.
    await quietly(() => held.ctx?.stopCompletion());
    await work.catch(() => {});
    await quietly(() => held.ctx?.release());
  }
}
