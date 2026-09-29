import { NativeModules, Platform } from 'react-native';
import type { PetId } from '@/constants/onboardingStrings';

// 반려동물 사진 → 고른 견종 픽셀 캐릭터 (털색만 사진에서 가져온다).
// 실제 연산은 안드로이드 네이티브(PetRecolorModule.kt) — AI 저장소 pet_template/reference.py 이식.
// 사진은 기기 밖으로 나가지 않는다.

type Native = {
  make(photoUri: string, breed: string): Promise<MadePet>;
};

const native: Native | undefined = NativeModules.PetoxPetRecolor;

export type MadePet = {
  uri: string;
  main: string | null;
  sub: string | null;
  /** 배경 제거(ML Kit)로 반려동물만 보고 뽑았는가 */
  segmented?: boolean;
};

/** 사진이 없거나 네이티브가 없으면(다시 빌드 전) null — 견종 원본 그림으로 진행한다 */
export async function makePetFromPhoto(
  photoUri: string | undefined,
  breed: PetId,
): Promise<MadePet | null> {
  if (!photoUri || Platform.OS !== 'android' || !native) return null;
  const r = await native.make(photoUri, breed);
  if (__DEV__)
    console.log(
      '[recolor] 털색',
      r.main,
      r.sub,
      '배경제거',
      r.segmented,
      r.uri,
    );
  return r;
}
