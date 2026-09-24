import { AuthError } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/api/supabase';
import { stopOverlay } from '@/features/overlay/overlay';
import { petoxStrings as S } from '@/constants/petoxStrings';
import { hasServerPet } from '@/api/onboarding';
import { loadPetProfile } from '@/storage/petProfile';

// ADR-002: 로그인·회원가입은 FastAPI(/auth/signup)를 거치지 않고 Supabase Auth 를 직접 쓴다.
// FastAPI 쪽은 user_id 만 돌려주고 세션(JWT)을 주지 않아서, 가입 직후 RLS 가 걸린
// profiles·check_in 등을 호출할 수 없기 때문이다.

export type SignUpResult =
  /** 가입과 동시에 로그인됨 (이메일 인증 꺼짐) */
  | { status: 'signedIn' }
  /** 가입은 됐지만 이메일 인증 전이라 세션이 없음 (Supabase 에서 Confirm email 이 켜진 경우) */
  | { status: 'needsEmailConfirm' };

/**
 * 인증 메일 링크를 누르면 돌아올 주소. 안드로이드 매니페스트에 petox://auth-callback 을 등록해 두어
 * 링크를 누르면 앱이 다시 열린다. Supabase 대시보드 Authentication > URL Configuration >
 * Redirect URLs 에 이 주소가 있어야 적용되고, 없으면 Site URL(지금 localhost:3000)로 간다.
 */
export const EMAIL_REDIRECT_URL = 'petox://auth-callback';

// 인증 메일을 기다리는 동안만 쓰는 가입 정보. 인증이 끝나면 이걸로 바로 로그인해 온보딩으로 보낸다.
// 기기에 저장하지 않는다(메모리에만) — 앱을 껐다 켜면 사라지고, 그땐 로그인 화면에서 직접 로그인한다.
type PendingSignup = { email: string; password: string; nickname: string };
let pendingSignup: PendingSignup | null = null;
export const getPendingSignup = () => pendingSignup;
export const clearPendingSignup = () => {
  pendingSignup = null;
};

/** 인증 메일 다시 보내기 */
export async function resendSignupEmail(email: string) {
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: email.trim(),
    options: { emailRedirectTo: EMAIL_REDIRECT_URL },
  });
  if (error) throw error;
}

export async function signUpWithEmail(
  nickname: string,
  email: string,
  password: string,
): Promise<SignUpResult> {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    // 이메일 인증 때문에 세션이 바로 안 오더라도 닉네임이 계정에 남도록 메타데이터에도 넣는다.
    options: { data: { nickname }, emailRedirectTo: EMAIL_REDIRECT_URL },
  });
  if (error) throw error;
  if (!data.session || !data.user) {
    pendingSignup = { email: email.trim(), password, nickname };
    return { status: 'needsEmailConfirm' };
  }

  // profiles 행은 BE 트리거(handle_new_user)가 가입 시 자동으로 만든다. 닉네임만 채운다.
  // 실패해도 가입 자체는 성공이므로 흐름을 막지 않는다.
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ nickname })
    .eq('id', data.user.id);
  if (profileError) console.warn('닉네임 저장 실패', profileError.message);

  return { status: 'signedIn' };
}

export async function signInWithEmail(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) throw error;
}

export async function hasSession(): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  return data.session !== null;
}

/**
 * 로그인된 뒤 어디로 보낼지. 온보딩(목표·시간대·캐릭터)을 끝냈으면 홈, 아니면 온보딩.
 * 계정 기준으로 판단한다: 서버에 내 펫(pets)이 있으면 완료.
 * 서버를 확인할 수 없을 때만 이 계정의 기기 저장값으로 판단한다.
 * (이메일 인증 후 처음 로그인하는 새 계정은 서버에도 기기에도 펫이 없으니 온보딩으로 간다)
 */
export async function routeAfterLogin(): Promise<'Home' | 'OnboardingWelcome'> {
  try {
    const server = await hasServerPet();
    if (server !== null) return server ? 'Home' : 'OnboardingWelcome';
    return (await loadPetProfile()) !== null ? 'Home' : 'OnboardingWelcome';
  } catch {
    return 'OnboardingWelcome';
  }
}

/** Supabase 인증 에러 → 화면에 보여줄 문구. */
export function authErrorMessage(e: unknown): string {
  if (e instanceof AuthError) {
    switch (e.code) {
      case 'invalid_credentials':
        return S.authErrorInvalidCredentials;
      case 'user_already_exists':
        return S.authErrorUserExists;
      case 'weak_password':
        return S.authErrorWeakPassword;
      case 'email_not_confirmed':
        return S.authErrorEmailNotConfirmed;
      case 'email_address_invalid':
        return S.signupErrorEmail;
      case 'over_request_rate_limit':
      case 'over_email_send_rate_limit':
        return S.authErrorRateLimit;
    }
    // 네트워크 끊김 등 code 가 없는 경우
    if (e.status === 0 || e.name === 'AuthRetryableFetchError') {
      return S.authErrorNetwork;
    }
  }
  return S.authErrorUnknown;
}

export async function signOut() {
  stopOverlay(); // 다음 계정의 설정으로 다시 켜질 때까지 펫 오버레이를 끈다
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * 회원탈퇴 — BE Edge Function delete-account (이슈 #13).
 * 서버가 로그인 토큰으로 본인만 지우고, 내 데이터(프로필·펫·코인·아이템 등)는 전부 연쇄 삭제된다.
 * 성공하면 이 기기에 남은 계정 데이터도 지우고 로그아웃한다. 되돌릴 수 없다.
 */
export async function deleteAccount(): Promise<void> {
  const { data: auth } = await supabase.auth.getSession();
  const uid = auth.session?.user.id;
  if (!uid) throw new Error('not signed in');

  const { error } = await supabase.functions.invoke('delete-account', {
    method: 'POST',
  });
  if (error) throw error;

  // 기기에 남은 이 계정 데이터 (펫 정보·감지 앱 선택)와 펫 오버레이
  await Promise.all(
    [`petox.petProfile.${uid}`, `petox.detectedApps.${uid}`].map(key =>
      AsyncStorage.removeItem(key).catch(() => {}),
    ),
  );
  stopOverlay();
  // 서버의 사용자는 이미 지워졌으니 기기 세션만 지운다
  await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
}
