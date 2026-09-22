import { useEffect } from 'react';
import { AppState } from 'react-native';
import { supabase } from '@/api/supabase';

// 앱을 열면 출석한다(BE check_in RPC, ADR-27). 서버가 KST 날짜로 하루 한 번만
// 기록·지급하므로 여러 번 불러도 안전하다 — 앱을 켜둔 채 날짜가 바뀌는 경우를 위해
// 포그라운드로 돌아올 때와 로그인 직후에도 부른다.
async function checkIn() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) return;
  const { error } = await supabase.rpc('check_in');
  if (error) console.warn('출석 체크 실패', error.message);
}

export function useCheckInOnOpen() {
  useEffect(() => {
    checkIn();
    const { data: auth } = supabase.auth.onAuthStateChange(event => {
      if (event === 'SIGNED_IN') checkIn();
    });
    const appState = AppState.addEventListener('change', state => {
      if (state === 'active') checkIn();
    });
    return () => {
      auth.subscription.unsubscribe();
      appState.remove();
    };
  }, []);
}
