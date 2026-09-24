import { supabase } from '@/api/supabase';
import { loadPetProfile, savePetProfile } from '@/storage/petProfile';

// 마이페이지 > 사용자 관리 (목표 관리 · 감지 앱 관리 · 시간대 설정)
//
// - 목표 시간: 서버 profiles.goal_minutes 가 기준(미션 목표 계산에 쓰임). 기기 펫 정보에도 같이 적는다.
// - 감지 앱: 서버 detected_apps(전체 목록, 읽기 전용) + user_detected_apps(내 켜기/끄기).
//   내 설정 행이 없는 앱은 "켜짐"으로 본다(가입 직후엔 행이 없음).
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

export type DetectedApp = {
  /** detected_apps.id */
  id: string;
  packageName: string;
  name: string;
  enabled: boolean;
};

export async function fetchDetectedApps(): Promise<DetectedApp[]> {
  const [appsRes, mineRes] = await Promise.all([
    supabase
      .from('detected_apps')
      .select('id, package_name, display_name')
      .order('display_name'),
    supabase.from('user_detected_apps').select('app_id, is_enabled'),
  ]);
  if (appsRes.error) throw appsRes.error;
  if (mineRes.error) throw mineRes.error;
  const mine = new Map(
    (mineRes.data ?? []).map(r => [
      r.app_id as string,
      r.is_enabled as boolean,
    ]),
  );
  return (appsRes.data ?? []).map(r => ({
    id: r.id as string,
    packageName: r.package_name as string,
    name: r.display_name as string,
    enabled: mine.get(r.id as string) ?? true,
  }));
}

export async function setDetectedAppEnabled(
  appId: string,
  enabled: boolean,
): Promise<void> {
  const uid = await myUserId();
  if (!uid) throw new Error('not signed in');
  const { error } = await supabase
    .from('user_detected_apps')
    .upsert(
      { user_id: uid, app_id: appId, is_enabled: enabled },
      { onConflict: 'user_id,app_id' },
    );
  if (error) throw error;
}

/** 오버레이가 감시할 앱 패키지들. 서버를 못 읽으면 null(기본 목록 사용). */
export async function enabledAppPackages(): Promise<string[] | null> {
  if (!(await myUserId())) return null;
  try {
    return (await fetchDetectedApps())
      .filter(a => a.enabled)
      .map(a => a.packageName);
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
