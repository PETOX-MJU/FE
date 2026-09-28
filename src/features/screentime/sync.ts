import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/api/supabase';
import { loadSelectedApps } from '@/api/settings';
import { showDialog } from '@/components/AppDialog';
import { screentime, type DailyUsageDay } from '@/features/screentime/onDevice';

// 사용시간 업로드 — 폰에서 잰 날짜별·앱별 사용시간을 서버 daily_usage 에 "하루·앱마다 한 줄"로 올린다.
//
// 왜 필요한가: 서버는 매일 00:05(KST)에 방금 끝난 어제 미션을 정산하는데, 그날 daily_usage 행이
// 하나도 없으면 미션을 실패로 본다 (BE 20260921090000_require_usage_sync.sql). 그래서 0분인 날도
// 행을 올린다 — 서버가 보는 건 "그날 앱이 살아서 보고했는가"다.
//
// 개인정보: 앱별 하루 합계(분)만 보낸다. 화면 내용·영상·원시 이벤트는 보내지 않는다.
// 사용자가 동의했을 때만 보낸다 (AI kotlin_port/contracts/android-data-contract.md 6절).
// 동의는 OS 사용 정보 접근 권한과 따로 저장한다(권한을 다시 켜도 동의가 자동 복구되지 않는다).

/** 최근 며칠을 올릴지 (오늘 포함). 주간 리포트가 지난주까지 보므로 일주일. */
const SYNC_DAYS = 7;
/** 너무 자주 올리지 않는다. 화면 전환마다 불려도 이 간격 안에서는 한 번만. */
const MIN_INTERVAL_MS = 5 * 60_000;

/** 서버 detected_apps 에 없는 지역판 패키지를 서버 앱으로 묶는다. */
const PACKAGE_ALIASES: Record<string, string> = {
  'com.ss.android.ugc.trill': 'com.zhiliaoapp.musically', // 틱톡 다른 지역판 → 틱톡
};

// ---- 동의 ----

export type UsageSyncConsent = 'granted' | 'denied' | null;
const CONSENT_PREFIX = 'petox.usageSyncConsent.';

async function myUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

/** 이 계정의 사용시간 저장 동의. 아직 안 물었으면 null. */
export async function loadUsageSyncConsent(): Promise<UsageSyncConsent> {
  const uid = await myUserId();
  if (!uid) return null;
  const v = await AsyncStorage.getItem(CONSENT_PREFIX + uid);
  return v === 'granted' || v === 'denied' ? v : null;
}

export async function saveUsageSyncConsent(v: 'granted' | 'denied'): Promise<void> {
  const uid = await myUserId();
  if (!uid) throw new Error('not signed in');
  await AsyncStorage.setItem(CONSENT_PREFIX + uid, v);
}

// ---- 올릴 행 만들기 (순수 함수, 테스트 대상) ----

export type DailyUsageRow = {
  user_id: string;
  app_id: string;
  usage_date: string;
  minutes: number;
};

/**
 * 네이티브 측정값 → daily_usage 행.
 *
 * - 기록이 없는 날(apps null)은 올리지 않는다. 0분으로 꾸미면 서버가 "지켰다"로 정산한다.
 * - 기록이 있는 날은 추적 중인 서버 앱마다 한 줄씩 올린다. 안 쓴 앱은 0분.
 * - 오늘·어제가 아닌 날은 complete 일 때만 올린다. 기기에 남은 기록이 오래돼 잘려 나가면
 *   예전에 올린 온전한 값을 더 작은 값으로 덮어쓸 수 있어서다.
 */
export function buildUsageRows(
  days: DailyUsageDay[],
  apps: Array<{ id: string; package_name: string }>,
  userId: string,
  today: string,
  yesterday: string,
): DailyUsageRow[] {
  const idByPackage = new Map(apps.map(a => [a.package_name, a.id]));
  const rows: DailyUsageRow[] = [];
  for (const day of days) {
    if (day.apps === null || day.quality === 'unavailable') continue;
    const recent = day.date === today || day.date === yesterday;
    if (!recent && day.quality !== 'complete') continue;
    const msByApp = new Map<string, number>(apps.map(a => [a.id, 0]));
    for (const usage of day.apps) {
      const pkg = PACKAGE_ALIASES[usage.package_name] ?? usage.package_name;
      const id = idByPackage.get(pkg);
      if (id) msByApp.set(id, (msByApp.get(id) ?? 0) + usage.duration_ms);
    }
    for (const [appId, ms] of msByApp) {
      rows.push({ user_id: userId, app_id: appId, usage_date: day.date, minutes: Math.round(ms / 60_000) });
    }
  }
  return rows;
}

/** 기기 시간대 기준 YYYY-MM-DD */
export function localDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// ---- 업로드 ----

export type SyncResult =
  | { status: 'uploaded'; rows: number }
  | {
      status: 'skipped';
      reason: 'no-session' | 'no-consent' | 'no-native' | 'no-permission' | 'throttled' | 'no-apps' | 'no-data';
    };

let lastSyncAt = 0;
let inFlight: Promise<SyncResult> | null = null;

/**
 * 동의했으면 최근 일주일 사용시간을 올린다. 같은 날·앱은 덮어쓴다(upsert)라 여러 번 불러도 안전하다.
 * force 가 아니면 5분 안에 다시 부르면 건너뛴다.
 */
export function syncDailyUsage(options: { force?: boolean } = {}): Promise<SyncResult> {
  if (inFlight) return inFlight;
  inFlight = runSync(options.force ?? false).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function runSync(force: boolean): Promise<SyncResult> {
  const userId = await myUserId();
  if (!userId) return { status: 'skipped', reason: 'no-session' };
  if ((await loadUsageSyncConsent()) !== 'granted') return { status: 'skipped', reason: 'no-consent' };
  if (!screentime.available) return { status: 'skipped', reason: 'no-native' };
  if (!(await screentime.hasUsageAccess())) return { status: 'skipped', reason: 'no-permission' };
  if (!force && Date.now() - lastSyncAt < MIN_INTERVAL_MS) return { status: 'skipped', reason: 'throttled' };

  // 서버가 아는 앱(유튜브·인스타·틱톡) 중 사용자가 감지 앱으로 고른 것만 올린다.
  const [{ data: serverApps, error }, selected] = await Promise.all([
    supabase.from('detected_apps').select('id, package_name'),
    loadSelectedApps(),
  ]);
  if (error) throw error;
  const chosen = new Set(selected.map(p => PACKAGE_ALIASES[p] ?? p));
  const apps = ((serverApps ?? []) as Array<{ id: string; package_name: string }>).filter(a =>
    chosen.has(a.package_name),
  );
  if (apps.length === 0) return { status: 'skipped', reason: 'no-apps' };

  const measured = [
    ...apps.map(a => a.package_name),
    ...Object.keys(PACKAGE_ALIASES).filter(alias => chosen.has(PACKAGE_ALIASES[alias])),
  ];
  const days = await screentime.dailyUsage(measured, SYNC_DAYS);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const rows = buildUsageRows(days, apps, userId, localDate(now), localDate(yesterday));
  if (rows.length === 0) return { status: 'skipped', reason: 'no-data' };

  const { error: upsertError } = await supabase
    .from('daily_usage')
    .upsert(rows, { onConflict: 'user_id,app_id,usage_date' });
  if (upsertError) throw upsertError;
  lastSyncAt = Date.now();
  if (__DEV__) console.log('[usage-sync] 업로드', rows.length, '행');
  return { status: 'uploaded', rows: rows.length };
}

// ---- 홈에서 부르는 진입점 ----

let askedThisSession = false;

/**
 * 홈에 올 때마다 부른다(권한이 다 갖춰진 뒤). 동의를 아직 안 물었으면 한 번 묻고,
 * 동의했으면 사용시간을 올린다. 실패해도 화면을 막지 않는다.
 */
export async function requestUsageSync(): Promise<void> {
  try {
    const consent = await loadUsageSyncConsent();
    if (consent === null) {
      if (askedThisSession || !(await myUserId())) return;
      askedThisSession = true;
      showDialog({
        title: '사용시간을 저장할까요?',
        message:
          '미션을 판정하고 코인을 드리려면 하루 사용시간이 서버에 있어야 해요. 유튜브·인스타그램·틱톡을 하루에 몇 분 썼는지만 보내고, 화면 내용이나 본 영상은 보내지 않아요. 마이페이지에서 언제든 바꿀 수 있어요.',
        confirmText: '저장할게요',
        cancelText: '안 할래요',
        onConfirm: async () => {
          await saveUsageSyncConsent('granted');
          await syncDailyUsage({ force: true }).catch(e => console.warn('사용시간 업로드 실패', e));
        },
        onCancel: () => {
          saveUsageSyncConsent('denied').catch(() => {});
        },
      });
      return;
    }
    if (consent === 'granted') await syncDailyUsage();
  } catch (e) {
    console.warn('사용시간 업로드 실패', e);
  }
}
