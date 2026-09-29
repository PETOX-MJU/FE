import { Image, NativeModules, type ImageSourcePropType } from 'react-native';
import { homePetImages } from '@/assets/images';
import { petWalk, type PetWalk } from '@/assets/images/petWalk';
import type { PetId } from '@/constants/onboardingStrings';

/**
 * 반려견 사진 → 털색(스와치 이름) → 견종 스프라이트 재색칠.
 * 네이티브 PetoxPetTemplate (android pet/PetTemplateModule.kt). 사진은 기기 밖으로 나가지 않는다.
 * 서버·프로필에는 main·sub 스와치 이름만 저장하고, 이미지는 이 함수로 언제든 다시 만든다.
 */

/** 스와치 이름 (black·brown·red·golden·cream·white·gray). null 이면 그 역할은 원본색. */
export type FurColors = { main: string | null; sub: string | null; reason?: string };

type Native = {
  extractFurColors(photoUri: string): Promise<FurColors>;
  renderPet(breed: PetId, main: string | null, sub: string | null, fit: boolean, sources: Record<string, string>): Promise<Record<string, string>>;
};

const native: Native | undefined = NativeModules.PetoxPetTemplate;

/** 사진(file:// 또는 content://) → 털색. 실패해도 reject 하지 않고 { main: null, sub: null } — 원본색으로 진행한다. */
export async function extractFurColors(photoUri: string): Promise<FurColors> {
  if (!native) return { main: null, sub: null, reason: 'unsupported' };
  return native.extractFurColors(photoUri);
}

export type PetSprites = { home: ImageSourcePropType; walk?: PetWalk };

/**
 * 홈 화면이 쓰는 스프라이트(앉기 + 걷기 프레임)를 털색으로 다시 칠한다.
 * 결과는 homePetImages[breed]·petWalk[breed] 와 같은 모양이라 그 자리에 그대로 넣으면 된다.
 * 사용자가 스와치를 직접 골랐으면 userPicked — 사진 추출값에만 하는 밝기 순서 맞추기를 끈다.
 * 실패하면 원본 스프라이트를 돌려준다.
 */
export async function renderPetSprites(breed: PetId, colors: FurColors, opts: { userPicked?: boolean } = {}): Promise<PetSprites> {
  const original: PetSprites = { home: homePetImages[breed], walk: petWalk[breed] };
  if (!native || (!colors.main && !colors.sub)) return original;

  const walk = petWalk[breed];
  // 디버그는 Metro 주소(http), 릴리스는 drawable 리소스 이름 — 네이티브가 둘 다 읽는다
  const uri = (src: ImageSourcePropType) => {
    const resolved = Image.resolveAssetSource(src as number);
    if (!resolved) throw new Error('스프라이트 위치를 알 수 없음');
    return resolved.uri;
  };
  try {
    const sources: Record<string, string> = { home: uri(homePetImages[breed]) };
    walk?.frames.forEach((frame, i) => (sources[`walk_${i}`] = uri(frame)));
    const out = await native.renderPet(breed, colors.main, colors.sub, !opts.userPicked, sources);
    return {
      home: { uri: out.home },
      walk: walk && { ...walk, frames: walk.frames.map((_, i) => ({ uri: out[`walk_${i}`] })) },
    };
  } catch (error) {
    console.warn('펫 재색칠 실패 — 원본색 사용', error);
    return original;
  }
}
