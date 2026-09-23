import { AuthError } from '@supabase/supabase-js';
import { supabase } from '@/api/supabase';
import { petoxStrings as S } from '@/constants/petoxStrings';
import { loadPetProfile } from '@/storage/petProfile';

// ADR-002: 로그인·회원가입은 FastAPI(/auth/signup)를 거치지 않고 Supabase Auth 를 직접 쓴다.
// FastAPI 쪽은 user_id 만 돌려주고 세션(JWT)을 주지 않아서, 가입 직후 RLS 가 걸린
// profiles·check_in 등을 호출할 수 없기 때문이다.

export type SignUpResult =
  /** 가입과 동시에 로그인됨 (이메일 인증 꺼짐) */
  | { status: 'signedIn' }
  /** 가입은 됐지만 이메일 인증 전이라 세션이 없음 (Supabase 에서 Confirm email 이 켜진 경우) */
  | { status: 'needsEmailConfirm' };

export async function signUpWithEmail(
  nickname: string,
  email: string,
  password: string,
): Promise<SignUpResult> {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    // 이메일 인증 때문에 세션이 바로 안 오더라도 닉네임이 계정에 남도록 메타데이터에도 넣는다.
    options: { data: { nickname } },
  });
  if (error) throw error;
  if (!data.session || !data.user) return { status: 'needsEmailConfirm' };

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
 * TODO: 지금은 기기(AsyncStorage)의 펫 프로필로 판단한다. 온보딩 결과를 서버(pets·profiles)에
 * 올리게 되면 "내 pets 행이 있는가"로 바꿔 계정 기준으로 판단할 것.
 */
export async function routeAfterLogin(): Promise<'Home' | 'OnboardingWelcome'> {
  try {
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
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
