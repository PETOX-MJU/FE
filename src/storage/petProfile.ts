import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PetId } from '@/constants/onboardingStrings';

const KEY = 'petox.petProfile';

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
};

export async function savePetProfile(profile: PetProfile): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(profile));
}

export async function loadPetProfile(): Promise<PetProfile | null> {
  const raw = await AsyncStorage.getItem(KEY);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as PetProfile;
  } catch {
    // 저장 값이 깨졌으면 없는 것으로 취급합니다.
    return null;
  }
}

export async function clearPetProfile(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
