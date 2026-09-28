import { AuthError } from '@supabase/supabase-js';
import { Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/api/supabase';
import { stopOverlay } from '@/features/overlay/overlay';
import { petoxStrings as S } from '@/constants/petoxStrings';
import { hasServerPet, restorePetProfileFromServer } from '@/api/onboarding';
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
    if (server) {
      // 새 기기·재설치면 기기에 펫 정보가 없다 — 서버 펫으로 되살린다 (마이페이지·펫 슬롯이 비지 않게)
      await restorePetProfileFromServer().catch(e =>
        console.warn('펫 정보 복원 실패', e),
      );
      return 'Home';
    }
    if (server === false) return 'OnboardingWelcome';
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

// ---- 카카오 로그인 (Supabase OAuth, PKCE) ----
// 1) Supabase 에서 카카오 로그인 주소를 받아 폰 브라우저로 연다
// 2) 로그인이 끝나면 petox://auth-callback?code=... 로 앱이 다시 열린다
// 3) handleAuthCallbackUrl 이 code 를 세션으로 바꾼다 (RootNavigator 가 주소를 넘겨줌)
// 카카오 개발자 콘솔 + Supabase Providers > Kakao + Redirect URLs 설정이 돼 있어야 한다.

export async function signInWithKakao(): Promise<void> {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'kakao',
    options: { redirectTo: EMAIL_REDIRECT_URL, skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (!data.url) throw new Error('no oauth url');
  await Linking.openURL(data.url);
}

export type AuthCallbackResult =
  | { status: 'signedIn' }
  | { status: 'error'; message: string }
  | { status: 'ignored' };

/**
 * 앱으로 돌아온 주소 처리. 카카오 로그인(?code=)이면 세션을 만든다.
 * 이메일 인증 링크로 돌아온 경우엔 이 기기에 PKCE 검증값이 없어 교환이 실패할 수 있는데,
 * 인증 자체는 이미 끝났고 인증 대기 화면이 비밀번호로 로그인하므로 조용히 넘긴다.
 */
export async function handleAuthCallbackUrl(
  url: string,
): Promise<AuthCallbackResult> {
  if (!url.startsWith(EMAIL_REDIRECT_URL)) return { status: 'ignored' };
  const query = url.split(/[?#]/).slice(1).join('&');
  const params = new URLSearchParams(query);
  const errorDesc = params.get('error_description') ?? params.get('error');
  if (errorDesc) return { status: 'error', message: errorDesc };
  const code = params.get('code');
  if (!code) return { status: 'ignored' };
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return { status: 'ignored' };
  return { status: 'signedIn' };
}
