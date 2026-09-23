import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '@/api/supabase';

// 코인 잔액 = coin_ledger 의 amount 합계 (BE ADR-004: 추가 전용 원장, 잔액 컬럼 없음).
// 원장은 RLS 로 본인 행만 읽히고, 쓰기는 서버 RPC(check_in·complete_mission·buy_item)만 한다.
// 그래서 FE 는 잔액을 직접 더하거나 빼지 않고, 코인이 바뀔 만한 순간에 다시 읽는다.

type Listener = () => void;
const listeners = new Set<Listener>();

/** 코인을 바꾸는 RPC(출석·미션 보상·구매)를 부른 뒤 호출하면, 떠 있는 잔액 표시가 새로 고쳐진다. */
export function notifyCoinsChanged() {
  listeners.forEach(fn => fn());
}

async function fetchBalance(): Promise<number | null> {
  const { data: auth } = await supabase.auth.getSession();
  if (!auth.session) return null; // 로그인 전
  // BE coin_balance RPC(ADR-32): 서버가 SUM 해서 숫자 하나만 돌려준다.
  const { data, error } = await supabase.rpc('coin_balance');
  if (!error) return Number(data ?? 0);
  // 아직 마이그레이션이 안 올라간 서버면 예전 방식(원장을 받아 합산)으로 계산한다.
  console.warn('coin_balance RPC 실패, 원장 합산으로 대체', error.message);
  const ledger = await supabase.from('coin_ledger').select('amount');
  if (ledger.error) throw ledger.error;
  return (ledger.data ?? []).reduce(
    (acc, row) => acc + (row.amount as number),
    0,
  );
}

/**
 * 현재 로그인한 사용자의 코인 잔액.
 * 화면에 돌아올 때, 앱이 다시 앞으로 올 때, 로그인할 때, notifyCoinsChanged() 때 다시 읽는다.
 * 읽기 전·로그인 전·실패 시에는 null (표시는 0 으로).
 */
export function useCoinBalance() {
  const [coins, setCoins] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      setCoins(await fetchBalance());
    } catch (e) {
      console.warn('코인 잔액을 불러오지 못했어요', e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  useEffect(() => {
    listeners.add(refresh);
    const appState = AppState.addEventListener('change', state => {
      if (state === 'active') refresh();
    });
    const { data: auth } = supabase.auth.onAuthStateChange(event => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') refresh();
    });
    return () => {
      listeners.delete(refresh);
      appState.remove();
      auth.subscription.unsubscribe();
    };
  }, [refresh]);

  return { coins, refresh };
}
