import {
  Image,
  NativeModules,
  PermissionsAndroid,
  Platform,
  type ImageSourcePropType,
} from 'react-native';
import { homePetImages, petImages } from '@/assets/images';
import { screentime } from '@/features/screentime/onDevice';
import { loadPetProfile } from '@/storage/petProfile';

// 펫 오버레이 — 숏폼 앱을 오래 보면 내 펫이 다른 앱 위에 나타난다.
// 실제 감지·표시는 안드로이드 포그라운드 서비스(OverlayService.kt)가 한다.

type OverlayNative = {
  canDrawOverlays(): Promise<boolean>;
  openOverlaySettings(): void;
  start(config: {
    petUri?: string;
    appearAfterSec: number;
    growEverySec: number;
    targets?: string[];
  }): Promise<boolean>;
  stop(): void;
  isRunning(): Promise<boolean>;
};

const native: OverlayNative | undefined = NativeModules.PetoxOverlay;

/**
 * 몇 초 보면 나타나고, 몇 초마다 커질지.
 * 개발 모드는 시연·테스트용으로 짧게(5초), 배포는 기획대로 1분 뒤 등장 · 30초마다 확대.
 */
export const OVERLAY_TIMING = __DEV__
  ? { appearAfterSec: 5, growEverySec: 5 }
  : { appearAfterSec: 60, growEverySec: 30 };

/** 감지할 숏폼 앱. 개발 모드에선 에뮬레이터 테스트용으로 크롬도 넣는다 (유튜브·인스타 없이 확인 가능). */
export const OVERLAY_TARGETS = [
  'com.google.android.youtube',
  'com.instagram.android',
  'com.zhiliaoapp.musically',
  'com.ss.android.ugc.trill',
  ...(__DEV__ ? ['com.android.chrome'] : []),
];

export const overlayAvailable =
  Platform.OS === 'android' && native !== undefined;

export type OverlayPermissions = {
  overlay: boolean; // 다른 앱 위에 표시
  usage: boolean; // 사용 정보 접근 (지금 어떤 앱을 보는지)
  notification: boolean; // 상태 알림 (Android 13+)
};

export async function checkOverlayPermissions(): Promise<OverlayPermissions> {
  const overlay = (await native?.canDrawOverlays()) ?? false;
  const usage = await screentime.hasUsageAccess();
  const notification =
    Platform.OS !== 'android' || Platform.Version < 33
      ? true
      : await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
        );
  return { overlay, usage, notification };
}

export const openOverlaySettings = () => native?.openOverlaySettings();
export const openUsageSettings = () => screentime.openUsageAccessSettings();

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android' || Platform.Version < 33) return true;
  const r = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
  );
  return r === PermissionsAndroid.RESULTS.GRANTED;
}

/** 오버레이에 띄울 내 펫 이미지 주소 (개발: Metro URL / 배포: drawable 이름 / 사진: file://) */
async function currentPetUri(): Promise<string | undefined> {
  const profile = await loadPetProfile().catch(() => null);
  if (profile?.generatedUri) return profile.generatedUri;
  const source: ImageSourcePropType = profile?.pet
    ? homePetImages[profile.pet]
    : petImages.rottweiler;
  return Image.resolveAssetSource(source)?.uri;
}

/**
 * 권한이 다 있으면 서비스를 (다시) 시작한다. 펫이 바뀌었으면 새 펫으로 갱신된다.
 * 오버레이는 끌 수 없는 필수 기능이라 설정 토글이 없다. 권한이 빠져 있으면 false.
 */
export async function syncOverlay(): Promise<boolean> {
  if (!overlayAvailable) {
    if (__DEV__) console.log('[overlay] 네이티브 모듈 없음 — npm run android 로 다시 빌드 필요');
    return false;
  }
  const p = await checkOverlayPermissions();
  if (__DEV__) console.log('[overlay] 권한', p);
  if (!p.overlay || !p.usage) return false;
  await native!.start({
    petUri: await currentPetUri(),
    ...OVERLAY_TIMING,
    targets: OVERLAY_TARGETS,
  });
  return true;
}

/** 다음에 안내할 권한 (없으면 null). 다른 앱 위에 표시 → 사용 정보 접근 순서. */
export async function nextMissingPermission(): Promise<'overlay' | 'usage' | null> {
  if (!overlayAvailable) return null;
  const p = await checkOverlayPermissions();
  if (!p.overlay) return 'overlay';
  if (!p.usage) return 'usage';
  return null;
}

export const overlayPermissionText = {
  overlay: {
    title: '다른 앱 위에 표시',
    message:
      '숏폼을 볼 때 펫이 나타나려면 이 권한이 꼭 필요해요. 설정에서 펫톡스를 허용하고 돌아와 주세요.',
  },
  usage: {
    title: '사용 정보 접근',
    message:
      '지금 숏폼 앱을 보고 있는지 알려면 이 권한이 꼭 필요해요. 설정에서 펫톡스를 허용하고 돌아와 주세요.',
  },
} as const;
