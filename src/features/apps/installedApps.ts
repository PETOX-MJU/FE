import { NativeModules, Platform } from 'react-native';

// 폰에 설치된 앱 목록 (네이티브 InstalledAppsModule.kt)

export type InstalledApp = {
  packageName: string;
  label: string;
  /** data:image/png;base64,… (못 읽으면 null) */
  icon: string | null;
};

type Native = { getLaunchableApps(): Promise<InstalledApp[]> };
const native: Native | undefined = NativeModules.PetoxApps;

export const installedAppsAvailable =
  Platform.OS === 'android' && native !== undefined;

let cache: InstalledApp[] | null = null;

/** 홈 화면에 아이콘이 있는 앱들 (이름순). 네이티브 모듈이 없으면 빈 목록. */
export async function getInstalledApps(): Promise<InstalledApp[]> {
  if (!native) return [];
  if (!cache) cache = await native.getLaunchableApps();
  return cache;
}
