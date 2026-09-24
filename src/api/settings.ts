import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/api/supabase';
import { loadPetProfile, savePetProfile } from '@/storage/petProfile';

// 마이페이지 > 사용자 관리 (목표 관리 · 감지 앱 관리 · 시간대 설정)
//
// - 목표 시간: 서버 profiles.goal_minutes 가 기준(미션 목표 계산에 쓰임). 기기 펫 정보에도 같이 적는다.
// - 감지 앱: 폰에 설치된 앱 중 선택 → 기기(계정별) 저장 + 서버에 있는 앱만 동기화.
// - 숏폼 방지 시간대: 서버에 여러 구간을 담을 칸이 없어 기기(계정별 펫 정보)에만 저장한다.

async function myUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

// ---- 목표 시간 ----

export async function fetchGoalMinutes(): Promise<number | null> {
  const uid = await myUserId();
  if (uid) {
    const { data, error } = await supabase
      .from('profiles')
      .select('goal_minutes')
      .eq('id', uid)
      .maybeSingle();
    if (!error && data?.goal_minutes != null)
      return data.goal_minutes as number;
  }
  const local = await loadPetProfile().catch(() => null);
  return local?.goalMinutes ?? null;
}

export async function saveGoalMinutes(minutes: number): Promise<void> {
  const uid = await myUserId();
  if (!uid) throw new Error('not signed in');
  const { error } = await supabase
    .from('profiles')
    .update({ goal_minutes: minutes })
    .eq('id', uid);
  if (error) throw error;
  const local = await loadPetProfile().catch(() => null);
  if (local) await savePetProfile({ ...local, goalMinutes: minutes });
}

// ---- 감지 앱 ----
// 사용자는 폰에 설치된 앱 중 아무거나 고를 수 있다. 고른 목록은 기기(계정별)에 저장하고,
// 서버 detected_apps 에 있는 앱(유튜브·인스타·틱톡)만 user_detected_apps 에도 켜기/끄기로 맞춘다
// (서버 목록은 읽기 전용이라 다른 앱은 서버에 담을 수 없다 — 미션은 서버 목록 기준).

/** 숏폼 추천 앱 — 목록 맨 위에 "추천"으로 보여 주고, 아무것도 안 골랐을 때 기본값 */
export const RECOMMENDED_APPS = [
  'com.google.android.youtube',
  'com.instagram.android',
  'com.zhiliaoapp.musically', // 틱톡
  'com.ss.android.ugc.trill', // 틱톡 (다른 지역판)
];

const APPS_KEY_PREFIX = 'petox.detectedApps.';

async function appsKey(): Promise<string | null> {
  const uid = await myUserId();
  return uid ? APPS_KEY_PREFIX + uid : null;
}

/** 내가 고른 감지 앱 패키지들. 한 번도 안 골랐으면 추천 앱. */
export async function loadSelectedApps(): Promise<string[]> {
  const key = await appsKey();
  const raw = key ? await AsyncStorage.getItem(key) : null;
  if (raw) {
    try {
      return JSON.parse(raw) as string[];
    } catch {
      // 깨졌으면 기본값
    }
  }
  return [...RECOMMENDED_APPS];
}

export async function saveSelectedApps(packages: string[]): Promise<void> {
  const key = await appsKey();
  if (!key) throw new Error('not signed in');
  await AsyncStorage.setItem(key, JSON.stringify(packages));
  syncServerApps(packages).catch(e =>
    console.warn('감지 앱 서버 동기화 실패', e),
  );
}

/** 서버에 있는 앱(detected_apps)만 켜기/끄기를 맞춘다. */
async function syncServerApps(packages: string[]): Promise<void> {
  const uid = await myUserId();
  if (!uid) return;
  const { data, error } = await supabase
    .from('detected_apps')
    .select('id, package_name');
  if (error) throw error;
  const rows = (data ?? []).map(r => ({
    user_id: uid,
    app_id: r.id as string,
    is_enabled: packages.includes(r.package_name as string),
  }));
  if (rows.length === 0) return;
  const { error: upsertError } = await supabase
    .from('user_detected_apps')
    .upsert(rows, { onConflict: 'user_id,app_id' });
  if (upsertError) throw upsertError;
}

/** 오버레이가 감시할 앱 패키지들. 로그인 전이면 null(기본 목록 사용). */
export async function enabledAppPackages(): Promise<string[] | null> {
  if (!(await myUserId())) return null;
  try {
    return await loadSelectedApps();
  } catch {
    return null;
  }
}

// ---- 숏폼 방지 시간대 ----

export async function fetchBlockSlots(): Promise<string[]> {
  const local = await loadPetProfile().catch(() => null);
  return local?.blockSlots ?? [];
}

export async function saveBlockSlots(slots: string[]): Promise<void> {
  const local = await loadPetProfile();
  if (!local) throw new Error('no pet profile');
  await savePetProfile({ ...local, blockSlots: slots });
}
