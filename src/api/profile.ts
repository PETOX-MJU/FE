import { supabase } from '@/api/supabase';

// 내 프로필·알림 설정 — RLS 로 본인 행만 읽고 쓴다.
// profiles 는 컬럼 단위로 쓰기 권한이 열려 있다(BE ADR-22: nickname·goal_minutes 등).

async function myUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

/**
 * 내 닉네임. profiles.nickname 이 정본이고, 비어 있으면 회원가입 때 계정 메타데이터에
 * 함께 넣어 둔 닉네임(user_metadata.nickname)을 쓴다 — 가입 직후 profiles 저장이
 * 실패했거나 이메일 인증 때문에 건너뛴 계정도 닉네임이 보이도록.
 * 메타데이터에서 찾았으면 profiles 에도 채워 넣어 다음부터는 정본에서 읽히게 한다.
 */
export async function fetchNickname(): Promise<string | null> {
  const { data: auth } = await supabase.auth.getSession();
  const user = auth.session?.user;
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('nickname')
    .eq('id', user.id)
    .maybeSingle();
  if (error) console.warn('profiles.nickname 조회 실패', error.message);

  const fromProfile = (data?.nickname as string | null | undefined)?.trim();
  if (fromProfile) return fromProfile;

  const fromSignup = (
    user.user_metadata?.nickname as string | undefined
  )?.trim();
  if (fromSignup) {
    supabase
      .from('profiles')
      .update({ nickname: fromSignup })
      .eq('id', user.id)
      .then(
        ({ error: e }) => e && console.warn('닉네임 동기화 실패', e.message),
      );
    return fromSignup;
  }
  return null;
}

export async function updateNickname(nickname: string): Promise<void> {
  const uid = await myUserId();
  if (!uid) throw new Error('not signed in');
  const { error } = await supabase
    .from('profiles')
    .update({ nickname })
    .eq('id', uid);
  if (error) throw error;
}

export type NotificationSettings = {
  missionAlert: boolean;
  reportAlert: boolean;
};

/** 행이 아직 없으면 BE 기본값(둘 다 켬)으로 본다. */
export async function fetchNotificationSettings(): Promise<NotificationSettings | null> {
  const uid = await myUserId();
  if (!uid) return null;
  const { data, error } = await supabase
    .from('notification_settings')
    .select('mission_alert, report_alert')
    .eq('user_id', uid)
    .maybeSingle();
  if (error) throw error;
  return {
    missionAlert: (data?.mission_alert as boolean | undefined) ?? true,
    reportAlert: (data?.report_alert as boolean | undefined) ?? true,
  };
}

export async function saveNotificationSettings(
  s: NotificationSettings,
): Promise<void> {
  const uid = await myUserId();
  if (!uid) throw new Error('not signed in');
  const { error } = await supabase.from('notification_settings').upsert({
    user_id: uid,
    mission_alert: s.missionAlert,
    report_alert: s.reportAlert,
  });
  if (error) throw error;
}
