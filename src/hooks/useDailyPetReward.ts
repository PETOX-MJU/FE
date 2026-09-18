import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'petox:lastPetRewardDate';

function todayKey(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

// 펫을 쓰다듬어 코인을 받는 건 하루 1회로 제한한다.
// TODO: 지금은 기기 로컬(AsyncStorage) 기준이라 기기를 바꾸면 리셋된다.
// coin_ledger가 붙으면 서버 기준(오늘 이미 지급됐는지)으로 옮겨야 한다.
export function useDailyPetReward() {
  const [canClaim, setCanClaim] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(lastDate => {
      setCanClaim(lastDate !== todayKey());
    });
  }, []);

  const claim = useCallback((): boolean => {
    if (!canClaim) {
      return false;
    }
    setCanClaim(false);
    AsyncStorage.setItem(STORAGE_KEY, todayKey());
    return true;
  }, [canClaim]);

  return { canClaim, claim };
}
