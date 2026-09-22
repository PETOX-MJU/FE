import { NativeModules } from 'react-native';
import { supabase } from '@/api/supabase';
import type { AnalysisOutput } from '@/features/screentime/dashboard';

/** 분석 설정. 네이티브 PetoxScreentime.analyzeCurrentWeek 인자와 같은 모양이다. */
export type AnalysisSettings = {
  targetPackages: string[];
  weekdayBed: string;
  weekdayWake: string;
  weekendBed: string;
  weekendWake: string;
  dailyTargetMinutes: number;
  nightTargetMinutes: number;
};

// 백엔드에 없는 값(기상 시각, 평일·주말 구분, 야간 목표)과 로그인 전 기본값.
// 줄일 앱은 BE detected_apps 시드, 하루 목표는 profiles.goal_minutes 기본값과 같다.
// TODO: 온보딩에서 기상 시각·야간 목표를 받으면 여기 대신 그 값을 쓴다.
export const DEFAULT_SETTINGS: AnalysisSettings = {
  targetPackages: ['com.google.android.youtube', 'com.instagram.android', 'com.zhiliaoapp.musically'],
  weekdayBed: '00:00',
  weekdayWake: '07:00',
  weekendBed: '00:00',
  weekendWake: '07:00',
  dailyTargetMinutes: 60,
  nightTargetMinutes: 30,
};

type ScreentimeNative = {
  hasUsageAccess(): Promise<boolean>;
  openUsageAccessSettings(): void;
  analyzeCurrentWeek(settings: AnalysisSettings): Promise<string>;
};

const native: ScreentimeNative | undefined = NativeModules.PetoxScreentime;

export const screentime = {
  /** 안드로이드가 아니거나 네이티브 모듈이 없으면 false */
  available: native !== undefined,
  hasUsageAccess: () => native?.hasUsageAccess() ?? Promise.resolve(false),
  openUsageAccessSettings: () => native?.openUsageAccessSettings(),
  analyze: async (settings: AnalysisSettings): Promise<AnalysisOutput> =>
    JSON.parse(await native!.analyzeCurrentWeek(settings)),
};

/** 로그인했으면 BE profiles·user_detected_apps 값을 쓰고, 빈 값은 기본값으로 채운다. */
export async function loadAnalysisSettings(): Promise<AnalysisSettings> {
  const { data: auth } = await supabase.auth.getSession();
  const userId = auth.session?.user.id;
  if (!userId) return DEFAULT_SETTINGS;

  const [profile, apps] = await Promise.all([
    supabase.from('profiles').select('goal_minutes, bedtime').eq('id', userId).maybeSingle(),
    supabase.from('user_detected_apps').select('detected_apps(package_name)').eq('user_id', userId).eq('is_enabled', true),
  ]);
  if (profile.error || apps.error) {
    console.warn('분석 설정 조회 실패, 기본값 사용', profile.error?.message ?? apps.error?.message);
    return DEFAULT_SETTINGS;
  }
  return mergeSettings(
    profile.data,
    (apps.data as unknown as Array<{ detected_apps: { package_name: string } | null }>)
      .map(row => row.detected_apps?.package_name)
      .filter((name): name is string => !!name),
  );
}

export function mergeSettings(
  profile: { goal_minutes: number | null; bedtime: string | null } | null,
  packages: string[],
): AnalysisSettings {
  const bed = profile?.bedtime?.slice(0, 5); // "23:30:00" → "23:30"
  return {
    ...DEFAULT_SETTINGS,
    targetPackages: packages.length ? [...new Set(packages)] : DEFAULT_SETTINGS.targetPackages,
    ...(bed ? { weekdayBed: bed, weekendBed: bed } : {}),
    dailyTargetMinutes: profile?.goal_minutes || DEFAULT_SETTINGS.dailyTargetMinutes,
  };
}
