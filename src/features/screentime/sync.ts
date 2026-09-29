import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/api/supabase';
import { loadSelectedApps } from '@/api/settings';
import { showDialog } from '@/components/AppDialog';
import {
  dailyShortsUsage,
  type ShortsUsageDay,
} from '@/features/overlay/overlay';

// 미션용 기록 업로드 (BE 제안 9/29: "판정은 서버, 측정은 오버레이").
// 오버레이(OverlayService → UsageLog.kt)가 날짜(KST)별로 잰 두 숫자를 올린다.
//  1) 앱별 숏폼 시청 분 → daily_usage upsert (user_id, app_id, usage_date, minutes)
//     숏폼 화면(쇼츠·릴스)으로 판정된 시간만 센다. 화면 캡처를 거절했으면 그 앱을 본 시간.
//     0분인 날도 한 줄 올린다 — 행이 없으면 서버가 "보고 안 함"으로 보고 실패 처리한다.
//     단, 오버레이가 한 번도 돌지 않은 날(alive=false)은 올리지 않는다 — 기록이 없는 것이지 0분이 아니다.
//  2) 펫 등장 횟수 → RPC report_pet_calls(p_date, p_calls) (BE 가 만드는 중, 없으면 조용히 건너뜀)
// 미션 생성·판정·코인 지급은 전부 서버가 한다.
//
// 개인정보: 하루 합계 숫자만 보낸다. 화면 내용·영상은 저장도 전송도 하지 않는다. 동의한 경우에만 보낸다.

/** 최근 며칠을 올릴지 (오늘 포함). 기기에도 7일치만 남는다. */
const SYNC_DAYS = 7;
/** 너무 자주 올리지 않는다. 홈에 올 때마다 불려도 이 간격 안에서는 한 번만. */
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

/** 이 계정의 기록 저장 동의. 아직 안 물었으면 null. */
export async function loadUsageSyncConsent(): Promise<UsageSyncConsent> {
  const uid = await myUserId();
  if (!uid) return null;
  const v = await AsyncStorage.getItem(CONSENT_PREFIX + uid);
  return v === 'granted' || v === 'denied' ? v : null;
}

export async function saveUsageSyncConsent(
  v: 'granted' | 'denied',
): Promise<void> {
  const uid = await myUserId();
  if (!uid) throw new Error('not signed in');
  await AsyncStorage.setItem(CONSENT_PREFIX + uid, v);
}

// ---- 올릴 행 만들기 (순수 함수) ----

export type DailyUsageRow = {
  user_id: string;
  app_id: string;
  usage_date: string;
  minutes: number;
};

/** 오버레이 기록 → daily_usage 행. 날마다 추적 중인 서버 앱마다 한 줄 (안 본 앱은 0분). */
export function buildUsageRows(
  days: ShortsUsageDay[],
  apps: Array<{ id: string; package_name: string }>,
  userId: string,
): DailyUsageRow[] {
  const idByPackage = new Map(apps.map(a => [a.package_name, a.id]));
  const rows: DailyUsageRow[] = [];
  for (const day of days) {
    const secByApp = new Map<string, number>(apps.map(a => [a.id, 0]));
    for (const [pkg0, sec] of Object.entries(day.apps)) {
      const pkg = PACKAGE_ALIASES[pkg0] ?? pkg0;
      const id = idByPackage.get(pkg);
      if (id) secByApp.set(id, (secByApp.get(id) ?? 0) + sec);
    }
    for (const [appId, sec] of secByApp) {
      rows.push({
        user_id: userId,
        app_id: appId,
        usage_date: day.date,
        minutes: Math.round(sec / 60),
      });
    }
  }
  return rows;
}

// ---- 업로드 ----

export type SyncResult =
  | { status: 'uploaded'; rows: number; petDays: number }
  | {
      status: 'skipped';
      reason:
        | 'no-session'
        | 'no-consent'
        | 'no-native'
        | 'no-data'
        | 'throttled'
        | 'no-apps';
    };

let lastSyncAt = 0;
let inFlight: Promise<SyncResult> | null = null;

/**
 * 동의했으면 최근 일주일 기록을 올린다. 같은 날·앱은 덮어쓴다(upsert)라 여러 번 불러도 안전하다.
 * force 가 아니면 5분 안에 다시 부르면 건너뛴다.
 */
export function syncDailyUsage(
  options: { force?: boolean } = {},
): Promise<SyncResult> {
  if (inFlight) return inFlight;
  inFlight = runSync(options.force ?? false).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function runSync(force: boolean): Promise<SyncResult> {
  const userId = await myUserId();
  if (!userId) return { status: 'skipped', reason: 'no-session' };
  if ((await loadUsageSyncConsent()) !== 'granted')
    return { status: 'skipped', reason: 'no-consent' };
  if (!force && Date.now() - lastSyncAt < MIN_INTERVAL_MS)
    return { status: 'skipped', reason: 'throttled' };
  const recorded = await dailyShortsUsage(SYNC_DAYS);
  if (!recorded) return { status: 'skipped', reason: 'no-native' };
  // 오버레이가 꺼져 있던 날은 올리지 않는다 — 0분으로 올리면 서버가 미션 성공으로 본다
  const days = recorded.filter(d => d.alive);
  if (days.length === 0) return { status: 'skipped', reason: 'no-data' };

  // 서버가 아는 앱(유튜브·인스타·틱톡) 중 사용자가 감지 앱으로 고른 것만 올린다.
  const [{ data: serverApps, error }, selected] = await Promise.all([
    supabase.from('detected_apps').select('id, package_name'),
    loadSelectedApps(),
  ]);
  if (error) throw error;
  const chosen = new Set(selected.map(p => PACKAGE_ALIASES[p] ?? p));
  const apps = (
    (serverApps ?? []) as Array<{ id: string; package_name: string }>
  ).filter(a => chosen.has(a.package_name));
  if (apps.length === 0) return { status: 'skipped', reason: 'no-apps' };

  const rows = buildUsageRows(days, apps, userId);
  const { error: upsertError } = await supabase
    .from('daily_usage')
    .upsert(rows, { onConflict: 'user_id,app_id,usage_date' });
  if (upsertError) throw upsertError;

  // 펫 등장 횟수 — BE RPC 가 아직 없으면(배포 전) 조용히 건너뛴다
  let petDays = 0;
  for (const day of days) {
    const { error: rpcError } = await supabase.rpc('report_pet_calls', {
      p_date: day.date,
      p_calls: day.petCalls,
    });
    if (rpcError) {
      if (__DEV__)
        console.log('[usage-sync] report_pet_calls 건너뜀', rpcError.message);
      break;
    }
    petDays += 1;
  }

  lastSyncAt = Date.now();
  if (__DEV__)
    console.log(
      '[usage-sync] 업로드',
      rows.length,
      '행, 펫 횟수',
      petDays,
      '일',
    );
  return { status: 'uploaded', rows: rows.length, petDays };
}

// ---- 홈에서 부르는 진입점 ----

let askedThisSession = false;

/**
 * 앱을 켤 때·홈에 올 때 부른다(권한이 다 갖춰진 뒤). 동의를 아직 안 물었으면 한 번 묻고,
 * 동의했으면 기록을 올린다(5분에 한 번). 실패해도 화면을 막지 않는다.
 */
export async function requestUsageSync(): Promise<void> {
  try {
    const consent = await loadUsageSyncConsent();
    if (consent === null) {
      if (askedThisSession || !(await myUserId())) return;
      askedThisSession = true;
      showDialog({
        title: '미션 기록을 저장할까요?',
        message:
          '미션을 판정하고 코인을 드리려면 기록이 서버에 있어야 해요. 숏폼(쇼츠·릴스) 시청 시간과 펫 등장 횟수만 저장하고, 화면 내용이나 본 영상은 저장하지 않아요. 마이페이지에서 언제든 바꿀 수 있어요.',
        confirmText: '저장할게요',
        cancelText: '안 할래요',
        onConfirm: async () => {
          await saveUsageSyncConsent('granted');
          await syncDailyUsage({ force: true }).catch(e =>
            console.warn('미션 기록 업로드 실패', e),
          );
        },
        onCancel: () => {
          saveUsageSyncConsent('denied').catch(() => {});
        },
      });
      return;
    }
    if (consent === 'granted') await syncDailyUsage();
  } catch (e) {
    console.warn('미션 기록 업로드 실패', e);
  }
}
