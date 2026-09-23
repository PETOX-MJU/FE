import { supabase } from '@/api/supabase';

// 상점 구매 — BE buy_item(p_item_id, p_request_id) RPC (ADR-004·008).
// 서버가 잔액 확인·코인 차감(coin_ledger)·보유 등록(user_items)을 한 트랜잭션으로 처리한다.
// FE 는 표시용으로만 잔액을 미리 비교하고, 최종 판단은 항상 서버가 한다.

/** BE items 테이블의 한 행 (전원 공유 카탈로그, 로그인 사용자만 읽기 가능) */
export type ServerItem = {
  id: string;
  name: string;
  type: 'clothing' | 'pet_slot' | 'furniture' | 'theme';
  price: number;
};

export type ShopState = {
  /** 이름 → 서버 아이템. FE 카탈로그(data/shop.ts)와 이름으로 짝을 짓는다. */
  itemsByName: Map<string, ServerItem>;
  /** 내가 가진 아이템 id(서버 uuid) */
  ownedIds: Set<string>;
};

export async function fetchShopState(): Promise<ShopState> {
  const [itemsRes, ownedRes] = await Promise.all([
    supabase.from('items').select('id, name, type, price_coins'),
    supabase.from('user_items').select('item_id'),
  ]);
  if (itemsRes.error) throw itemsRes.error;
  if (ownedRes.error) throw ownedRes.error;

  const itemsByName = new Map<string, ServerItem>();
  for (const row of itemsRes.data ?? []) {
    itemsByName.set(row.name as string, {
      id: row.id as string,
      name: row.name as string,
      type: row.type as ServerItem['type'],
      price: row.price_coins as number,
    });
  }
  const ownedIds = new Set((ownedRes.data ?? []).map(r => r.item_id as string));
  return { itemsByName, ownedIds };
}

/** 멱등키. 같은 구매가 재시도돼도 서버가 한 번만 처리한다. */
function uuidV4(): string {
  const b = new Uint8Array(16);
  // react-native-get-random-values 폴리필이 global.crypto 를 채운다 (api/supabase.ts 에서 로드)
  (
    globalThis as unknown as {
      crypto: { getRandomValues(a: Uint8Array): void };
    }
  ).crypto.getRandomValues(b);
  /* eslint-disable no-bitwise -- UUID v4 버전·변형 비트를 세팅하는 표준 방식 */
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  /* eslint-enable no-bitwise */
  const h = Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(
    16,
    20,
  )}-${h.slice(20)}`;
}

export class NotEnoughCoinsError extends Error {}

export async function buyItem(itemId: string): Promise<void> {
  const { error } = await supabase.rpc('buy_item', {
    p_item_id: itemId,
    p_request_id: uuidV4(),
  });
  if (error) {
    // BE 가 잔액 부족일 때 던지는 메시지 (buy_item: raise exception '코인이 부족합니다')
    if (error.message.includes('코인이 부족')) throw new NotEnoughCoinsError();
    throw error;
  }
}
