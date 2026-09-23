import { supabase } from '@/api/supabase';

// 온보딩 결과를 서버에 올리고, 온보딩을 마쳤는지 서버 기준으로 확인한다.
// "펫이 등록돼 있으면 온보딩 완료" — 온보딩 마지막 단계가 펫 등록이라서.

async function myUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

/**
 * 온보딩 확정 결과 저장: 목표 시간(profiles.goal_minutes) + 펫(pets).
 * 펫은 계정당 슬롯 제한(기본 1마리)이 있어, 이미 있으면 이름만 고친다.
 * TODO: 숏폼 방지 시간대(여러 개)·기본 캐릭터 종류는 BE 에 담을 컬럼이 아직 없다.
 */
export async function saveOnboardingToServer(input: {
  petName: string;
  goalMinutes: number;
  isDefaultCharacter: boolean;
}): Promise<void> {
  const uid = await myUserId();
  if (!uid) throw new Error('not signed in');

  const { error: profileError } = await supabase
    .from('profiles')
    .update({ goal_minutes: input.goalMinutes })
    .eq('id', uid);
  if (profileError) throw profileError;

  const { data: existing, error: selectError } = await supabase
    .from('pets')
    .select('id')
    .eq('user_id', uid)
    .limit(1);
  if (selectError) throw selectError;

  if (existing && existing.length > 0) {
    const { error } = await supabase
      .from('pets')
      .update({ name: input.petName, is_default: input.isDefaultCharacter })
      .eq('id', existing[0].id as string);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('pets').insert({
      user_id: uid,
      name: input.petName,
      is_default: input.isDefaultCharacter,
    });
    if (error) throw error;
  }
}

/** 서버에 내 펫이 있는가. 확인할 수 없으면(오프라인·에러) null. */
export async function hasServerPet(): Promise<boolean | null> {
  const uid = await myUserId();
  if (!uid) return null;
  const { count, error } = await supabase
    .from('pets')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', uid);
  if (error) return null;
  return (count ?? 0) > 0;
}

/** 마이페이지 펫 이름 변경을 서버 pets 에도 반영한다. 펫이 없으면 아무것도 안 한다. */
export async function renameServerPet(name: string): Promise<void> {
  const uid = await myUserId();
  if (!uid) return;
  const { error } = await supabase
    .from('pets')
    .update({ name })
    .eq('user_id', uid);
  if (error) throw error;
}
