import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '@/api/supabase';
import { localDateKey } from '@/features/screentime/dashboard';
import { notifyCoinsChanged } from '@/hooks/useCoinBalance';

// 출석 = 오늘 처음 펫을 쓰다듬는 것. (예전엔 앱을 열면 자동 출석했다)
// 서버 check_in RPC 가 KST 날짜로 하루 한 번만 기록·지급하므로(BE ADR-27)
// 여러 번 불러도 안전하다. 오늘 출석 여부도 서버 attendance 기준이라 기기를 바꿔도 같다.

async function attendedToday(): Promise<boolean | null> {
  const { data: auth } = await supabase.auth.getSession();
  const uid = auth.session?.user.id;
  if (!uid) return null; // 로그인 전
  const { count, error } = await supabase
    .from('attendance')
    .select('attended_on', { count: 'exact', head: true })
    .eq('user_id', uid)
    .eq('attended_on', localDateKey(new Date()));
  if (error) throw error;
  return (count ?? 0) > 0;
}

export function useDailyCheckIn() {
  /** 오늘 아직 출석 전이고 로그인돼 있으면 true — 이때만 쓰다듬기로 출석할 수 있다. */
  const [canCheckIn, setCanCheckIn] = useState(false);

  useFocusEffect(
    useCallback(() => {
      attendedToday()
        .then(done => setCanCheckIn(done === false))
        .catch(e => console.warn('출석 여부 확인 실패', e));
    }, []),
  );

  /** 출석 처리. 성공하면 true (코인 잔액 표시도 새로 고친다). */
  const checkIn = useCallback(async (): Promise<boolean> => {
    setCanCheckIn(false); // 연속 탭 방지 — 먼저 막고, 실패하면 되돌린다
    const { error } = await supabase.rpc('check_in');
    if (error) {
      console.warn('출석 체크 실패', error.message);
      setCanCheckIn(true);
      return false;
    }
    notifyCoinsChanged();
    return true;
  }, []);

  /**
   * 개발 모드 전용: 오늘 이미 출석했어도 말풍선·연출을 다시 보려고 "출석 전"으로 되돌린다.
   * 서버 출석 기록은 그대로라, 다시 쓰다듬어도 코인은 또 들어오지 않는다.
   */
  const devResetCheckIn = useCallback(() => {
    if (__DEV__) setCanCheckIn(true);
  }, []);

  return { canCheckIn, checkIn, devResetCheckIn };
}
