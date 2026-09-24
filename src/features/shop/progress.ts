import type { ImageSourcePropType } from 'react-native';
import type { ShopState } from '@/api/shop';
import { shopThemes, type ShopTheme } from '@/data/shop';

// 테마 진행 상황 — 구매 규칙(BE ADR-34)과 같은 기준으로 계산한다.
//  1) 테마를 가져야 그 테마 아이템을 산다
//  2) 아이템은 앞 단계부터 순서대로 산다 (FE items 배열 순서 = 서버 sort_order)

export type ThemeProgress = {
  /** 테마를 가졌는지 */
  themeOwned: boolean;
  /** 앞에서부터 연속으로 가진 아이템 수 (0~4) = 홈에 깔 scenes 번호 */
  ownedCount: number;
};

const owns = (shop: ShopState, name: string) => {
  const server = shop.itemsByName.get(name);
  return server ? shop.ownedIds.has(server.id) : false;
};

export function themeProgress(
  theme: ShopTheme,
  shop: ShopState,
): ThemeProgress {
  let ownedCount = 0;
  for (const item of theme.items) {
    if (!owns(shop, item.name)) break;
    ownedCount += 1;
  }
  return { themeOwned: owns(shop, theme.name), ownedCount };
}

/** 아이템이 잠겼으면 그 이유, 살 수 있으면(또는 이미 가졌으면) null */
export function itemLock(
  theme: ShopTheme,
  itemIndex: number,
  shop: ShopState,
): 'themeFirst' | 'inOrder' | null {
  const { themeOwned, ownedCount } = themeProgress(theme, shop);
  if (!themeOwned) return 'themeFirst';
  if (itemIndex > ownedCount) return 'inOrder';
  return null;
}

/** 적용 중인 테마 (없으면 기본 테마 = null) */
export function equippedTheme(shop: ShopState): ShopTheme | null {
  return (
    shopThemes.find(t => {
      const server = shop.itemsByName.get(t.name);
      return server ? shop.equippedIds.has(server.id) : false;
    }) ?? null
  );
}

/** 홈 배경 — 적용 중인 테마의 "앞에서부터 n개 산 모습". 없으면 null(기본 초원). */
export function homeSceneOf(shop: ShopState): ImageSourcePropType | null {
  const theme = equippedTheme(shop);
  if (!theme) return null;
  const { ownedCount } = themeProgress(theme, shop);
  const scenes = theme.scenes ?? [];
  return (
    scenes[Math.min(ownedCount, scenes.length - 1)] ?? theme.background ?? null
  );
}

/** 서버에 등록된 테마들의 id (테마 적용 시 나머지를 해제할 때 씀) */
export function serverThemeIds(shop: ShopState): string[] {
  return shopThemes
    .map(t => shop.itemsByName.get(t.name)?.id)
    .filter((id): id is string => !!id);
}
