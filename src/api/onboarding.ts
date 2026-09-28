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
  /** 기본 캐릭터를 골랐을 때 견종 (BE pets.breed) */
  breed?: string;
}): Promise<void> {
  const uid = await myUserId();
  if (!uid) throw new Error('not signed in');
  const breed = input.breed ? { breed: input.breed } : {};

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
      .update({
        name: input.petName,
        is_default: input.isDefaultCharacter,
        ...breed,
      })
      .eq('id', existing[0].id as string);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('pets').insert({
      user_id: uid,
      name: input.petName,
      is_default: input.isDefaultCharacter,
      ...breed,
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

/**
 * 마이페이지 펫 이름 변경을 서버 pets 에도 반영한다.
 * 펫이 여러 마리일 수 있어서, 서버 id 를 알면 그 펫만, 모르면(첫 펫) 가장 먼저 만든 펫만 바꾼다.
 */
export async function renameServerPet(name: string, serverId?: string): Promise<void> {
  const uid = await myUserId();
  if (!uid) return;
  let id = serverId;
  if (!id) {
    const { data, error } = await supabase
      .from('pets')
      .select('id')
      .eq('user_id', uid)
      .order('created_at', { ascending: true })
      .limit(1);
    if (error) throw error;
    id = data?.[0]?.id as string | undefined;
    if (!id) return;
  }
  const { error } = await supabase.from('pets').update({ name }).eq('id', id);
  if (error) throw error;
}

// ---- 펫 슬롯: 두 번째 펫부터 ----

export class PetSlotFullError extends Error {}

/** 계정이 키울 수 있는 펫 수 (profiles.pet_slot_limit, 기본 1 — 상점 펫 슬롯을 사면 늘어난다) */
export async function fetchPetSlotLimit(): Promise<number> {
  const uid = await myUserId();
  if (!uid) return 1;
  const { data, error } = await supabase
    .from('profiles')
    .select('pet_slot_limit')
    .eq('id', uid)
    .maybeSingle();
  if (error || data?.pet_slot_limit == null) return 1;
  return data.pet_slot_limit as number;
}

/**
 * 새 펫을 서버에 한 마리 더 만든다 (기존 펫은 그대로). 만든 pets.id 를 돌려준다.
 * 슬롯이 모자라면 서버 트리거가 'pet slot limit reached' 로 막는다 → PetSlotFullError.
 * breed 는 BE #27 견종 백업 칸 (기본 캐릭터를 골랐을 때).
 */
export async function addServerPet(input: {
  name: string;
  isDefaultCharacter: boolean;
  breed?: string;
}): Promise<string> {
  const uid = await myUserId();
  if (!uid) throw new Error('not signed in');
  const { data, error } = await supabase
    .from('pets')
    .insert({
      user_id: uid,
      name: input.name,
      is_default: input.isDefaultCharacter,
      ...(input.breed ? { breed: input.breed } : {}),
    })
    .select('id')
    .single();
  if (error) {
    if (error.message.includes('pet slot limit')) throw new PetSlotFullError();
    throw error;
  }
  return data.id as string;
}
