import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/api/supabase';
import type { PetId } from '@/constants/onboardingStrings';

// 온보딩에서 확정한 내 펫 정보 — 기기에 "계정별로" 저장한다.
// 예전엔 계정과 상관없이 기기에 하나만 저장해서, 한 기기에서 다른 계정으로 가입(이메일 인증)
// 후 로그인하면 이전 계정의 펫이 남아 있어 온보딩을 건너뛰는 문제가 있었다.
const KEY_PREFIX = 'petox.petProfile.';
/** 계정 구분 없이 저장하던 옛 키. 읽지 않고 지운다. */
const LEGACY_KEY = 'petox.petProfile';

/** 온보딩에서 확정한 내 펫 정보. */
export type PetProfile = {
  /** 사용자가 지어준 이름 */
  name: string;
  /** 기본 캐릭터를 골랐을 때 */
  pet?: PetId;
  /** 사진 변환으로 만들었을 때의 이미지 경로 */
  generatedUri?: string;
  /** 하루 목표 시간(분) */
  goalMinutes: number;
  /** 숏폼 방지 시간대 */
  blockSlots: string[];
  /** 등록 시각(ISO) */
  createdAt: string;
  /**
   * 키우는 펫 목록 (펫 슬롯). 없으면 위의 펫 한 마리뿐인 예전 저장값이다.
   * 위의 name·pet·generatedUri 는 "지금 홈에 나와 있는 펫"(activePetId)의 값이다.
   */
  pets?: LocalPet[];
  activePetId?: string;
};

/** 펫 슬롯 한 칸의 펫 */
export type LocalPet = {
  id: string;
  name: string;
  pet?: PetId;
  generatedUri?: string;
  /** 서버 pets.id (이름 변경 등에 씀). 모르면 없음 */
  serverId?: string;
  createdAt: string;
};

/** 키우는 펫 목록 — 예전 저장값(한 마리)도 목록으로 바꿔 돌려준다 */
export function petList(profile: PetProfile): LocalPet[] {
  if (profile.pets && profile.pets.length > 0) return profile.pets;
  return [
    {
      id: 'first',
      name: profile.name,
      pet: profile.pet,
      generatedUri: profile.generatedUri,
      createdAt: profile.createdAt,
    },
  ];
}

export function activePetId(profile: PetProfile): string {
  return profile.activePetId ?? petList(profile)[0].id;
}

/** 새 펫을 목록에 더하고 홈에 나올 펫으로 바꾼다 (기존 펫은 그대로 남는다) */
export async function addPet(entry: Omit<LocalPet, 'id' | 'createdAt'>): Promise<void> {
  const profile = await loadPetProfile();
  if (!profile) throw new Error('no pet profile');
  const pet: LocalPet = {
    ...entry,
    id: `pet-${Date.now()}`,
    createdAt: new Date().toISOString(),
  };
  await savePetProfile({
    ...profile,
    pets: [...petList(profile), pet],
    activePetId: pet.id,
    name: pet.name,
    pet: pet.pet,
    generatedUri: pet.generatedUri,
  });
}

/** 홈에 나올 펫을 바꾼다 */
export async function switchActivePet(id: string): Promise<void> {
  const profile = await loadPetProfile();
  if (!profile) return;
  const list = petList(profile);
  const next = list.find(p => p.id === id);
  if (!next) return;
  await savePetProfile({
    ...profile,
    pets: list,
    activePetId: id,
    name: next.name,
    pet: next.pet,
    generatedUri: next.generatedUri,
  });
}

/** 지금 펫의 이름을 바꾼다 (목록에도 반영). 서버 id 가 있으면 돌려준다 */
export async function renameActivePet(name: string): Promise<string | undefined> {
  const profile = await loadPetProfile();
  if (!profile) throw new Error('no pet profile');
  const id = activePetId(profile);
  const list = petList(profile).map(p => (p.id === id ? { ...p, name } : p));
  await savePetProfile({ ...profile, pets: list, activePetId: id, name });
  return list.find(p => p.id === id)?.serverId;
}

async function keyForCurrentUser(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  const uid = data.session?.user.id;
  return uid ? KEY_PREFIX + uid : null;
}

export async function savePetProfile(profile: PetProfile): Promise<void> {
  const key = await keyForCurrentUser();
  if (!key) throw new Error('not signed in');
  await AsyncStorage.setItem(key, JSON.stringify(profile));
  AsyncStorage.removeItem(LEGACY_KEY).catch(() => {});
}

/** 로그인한 계정의 펫 정보. 로그인 전이거나 저장된 게 없으면 null. */
export async function loadPetProfile(): Promise<PetProfile | null> {
  const key = await keyForCurrentUser();
  if (!key) return null;
  const raw = await AsyncStorage.getItem(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as PetProfile;
  } catch {
    // 저장 값이 깨졌으면 없는 것으로 취급합니다.
    return null;
  }
}

export async function clearPetProfile(): Promise<void> {
  const key = await keyForCurrentUser();
  if (key) await AsyncStorage.removeItem(key);
}
