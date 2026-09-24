import { useCallback, useEffect, useState } from 'react';
import type { ImageSourcePropType } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { fetchShopState, onShopChanged } from '@/api/shop';
import { supabase } from '@/api/supabase';
import { homeSceneOf } from '@/features/shop/progress';

/**
 * 홈 배경 그림. 적용 중인 테마가 있으면 산 아이템 단계의 그림, 없으면 null(기본 초원).
 * 화면에 돌아올 때, 구매·테마 적용 직후(notifyShopChanged), 로그인/로그아웃 때 다시 읽는다.
 */
export function useHomeScene(): ImageSourcePropType | null {
  const [scene, setScene] = useState<ImageSourcePropType | null>(null);

  const refresh = useCallback(async () => {
    try {
      const { data: auth } = await supabase.auth.getSession();
      if (!auth.session) return setScene(null);
      setScene(homeSceneOf(await fetchShopState()));
    } catch (e) {
      console.warn('홈 테마를 불러오지 못했어요', e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  useEffect(() => {
    const off = onShopChanged(refresh);
    const { data: auth } = supabase.auth.onAuthStateChange(event => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') refresh();
    });
    return () => {
      off();
      auth.subscription.unsubscribe();
    };
  }, [refresh]);

  return scene;
}
