import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { homeImages } from '@/assets/images';
import {
  NotEnoughCoinsError,
  ShopRuleError,
  buyItem,
  cachedShopState,
  equipItem,
  equipTheme,
  fetchShopState,
  notifyShopChanged,
  type ServerItem,
  type ShopRule,
  type ShopState,
} from '@/api/shop';
import {
  appliedItemCount,
  itemLock,
  serverThemeIds,
  themeProgress,
} from '@/features/shop/progress';
import { supabase } from '@/api/supabase';
import { ConfirmModal } from '@/components/ConfirmModal';
import { shopThemes, type ShopItem, type ShopTheme } from '@/data/shop';
import { notifyCoinsChanged, useCoinBalance } from '@/hooks/useCoinBalance';
import { fonts } from '@/theme/fonts';

const THEME_COL_W = 132; // 테마 카드 한 장 너비
const THEME_CARD_H = 186;
const GAP = 12;

// 서버가 구매 규칙으로 거절했을 때 (화면 잠금을 우회했거나 목록이 오래된 경우)
const RULE_TEXT: Record<ShopRule, string> = {
  alreadyOwned: '이미 가지고 있어요.',
  themeFirst: '테마를 먼저 구매해야 해요.',
  inOrder: '앞 단계 아이템부터 차례대로 구매해야 해요.',
};

/** 지금 적용 중인 테마가 목록의 몇 번째인지. 기본 테마(초원)는 목록에 없어서 -1. */
function equippedThemeIndex(shop: ShopState | null): number {
  if (!shop) return -1;
  return shopThemes.findIndex(t => {
    const server = shop.itemsByName.get(t.name);
    return server ? shop.equippedIds.has(server.id) : false;
  });
}

type Props = {
  // 말풍선 꼬리가 가리킬 위치 — 패널 오른쪽 끝에서 꼬리 중심까지의 거리
  tailRight?: number;
  style?: StyleProp<ViewStyle>;
};

// 상점 버튼에서 펼쳐지는 말풍선 패널.
// 왼쪽은 테마(좌우로 넘김), 오른쪽은 그 테마에 속한 아이템 4개.
export function ShopPanel({ tailRight = 27, style }: Props) {
  // 홈 화면이 받아 둔 값으로 시작한다 — 첫 그림부터 적용 중인 테마가 보인다
  const [themeIndex, setThemeIndex] = useState(() =>
    Math.max(0, equippedThemeIndex(cachedShopState())),
  );
  const [gridW, setGridW] = useState(0);
  const listRef = useRef<FlatList<ShopTheme>>(null);

  // 테마 목록이 줄어들어도(빌드 중 Fast Refresh, 서버 목록 변경 등) 범위를 벗어나지 않게 맞춘다.
  const safeIndex = Math.min(themeIndex, shopThemes.length - 1);
  const theme = shopThemes[safeIndex];
  const itemSize = gridW > 0 ? (gridW - GAP) / 2 : 0;

  // 서버 카탈로그(가격·uuid)와 내 보유 목록. 패널이 열릴 때마다 새로 읽는다.
  const [shop, setShop] = useState<ShopState | null>(cachedShopState);
  const [buying, setBuying] = useState(false);
  const { coins } = useCoinBalance();

  // 앱 스타일 팝업 하나를 내용만 바꿔 가며 쓴다 (기본 Alert 대신)
  type Dialog = {
    title: string;
    message?: string;
    image?: ImageSourcePropType;
    confirmText?: string;
    confirmColor?: string;
    /** 있으면 취소 + 확인 두 버튼, 없으면 확인 하나 */
    onConfirm?: () => Promise<void>;
  };
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const notice = (
    title: string,
    message?: string,
    image?: ImageSourcePropType,
  ) => setDialog({ title, message, image });

  const loadShop = useCallback(async () => {
    try {
      setShop(await fetchShopState());
    } catch (e) {
      console.warn('상점 정보를 불러오지 못했어요', e);
    }
  }, []);

  useEffect(() => {
    loadShop();
  }, [loadShop]);

  // 기억해 둔 값이 없었던 첫 실행에서만, 서버 응답이 오면 자리를 맞춘다.
  // 한 번 넘겨 본 뒤에는 건드리지 않는다 (구매하고 돌아올 때 자리가 튀지 않게).
  const jumped = useRef(cachedShopState() !== null);
  useEffect(() => {
    if (!shop || jumped.current) return;
    jumped.current = true;
    const index = equippedThemeIndex(shop);
    if (index <= 0) return;
    setThemeIndex(index);
    listRef.current?.scrollToOffset({
      offset: index * THEME_COL_W,
      animated: false,
    });
  }, [shop]);

  /** 화면에 보일 가격 — 서버에 등록된 아이템이면 서버 가격이 기준이다. */
  const priceOf = (entry: { name: string; price: number }) =>
    shop?.itemsByName.get(entry.name)?.price ?? entry.price;
  const isOwned = (entry: { name: string; owned?: boolean }) => {
    const server = shop?.itemsByName.get(entry.name);
    return server ? shop!.ownedIds.has(server.id) : !!entry.owned;
  };

  const isEquipped = (t: ShopTheme) => {
    const server = shop?.itemsByName.get(t.name);
    return server ? shop!.equippedIds.has(server.id) : false;
  };
  const lockOf = (t: ShopTheme, index: number) =>
    shop ? itemLock(t, index, shop) : null;
  /** 앞에서부터 몇 개가 적용 중인지 — 그 다음 하나만 적용, 마지막 하나만 해제할 수 있다 */
  const appliedCount = shop ? appliedItemCount(theme, shop) : 0;

  const requireLogin = async () => {
    const { data: auth } = await supabase.auth.getSession();
    if (auth.session) return true;
    notice('로그인이 필요해요', '로그인하면 코인으로 아이템을 살 수 있어요.');
    return false;
  };

  /** 확인 → 서버 구매 → 잔액·상점·홈 배경 갱신. 성공하면 onBought 실행. */
  const purchase = (
    entry: { name: string; image?: ImageSourcePropType },
    server: ServerItem,
    onBought?: () => Promise<void>,
  ) => {
    const balance = coins ?? 0;
    if (balance < server.price) {
      notice(
        '코인이 부족해요',
        `${server.price}코인이 필요해요. (지금 ${balance}코인)`,
        entry.image,
      );
      return;
    }
    setDialog({
      title: '구매할까요?',
      message: `${entry.name}을(를) ${server.price}코인에 구매할까요?`,
      image: entry.image,
      confirmText: '구매',
      onConfirm: async () => {
        setBuying(true);
        let result: Dialog;
        try {
          await buyItem(server.id);
          await onBought?.();
          result = {
            title: '구매 완료',
            message: `${entry.name}을(를) 샀어요!`,
            image: entry.image,
          };
        } catch (e) {
          if (e instanceof NotEnoughCoinsError) {
            result = {
              title: '코인이 부족해요',
              message: '잔액이 바뀌었어요. 다시 확인해 주세요.',
            };
          } else if (e instanceof ShopRuleError) {
            result = { title: entry.name, message: RULE_TEXT[e.rule] };
          } else {
            result = {
              title: '구매 실패',
              message: '잠시 후 다시 시도해 주세요.',
            };
          }
        } finally {
          notifyCoinsChanged();
          notifyShopChanged();
          await loadShop();
          setBuying(false);
        }
        setDialog(result);
      },
    });
  };

  // 테마: 안 가졌으면 구매(사면 바로 적용), 가졌으면 적용 ↔ 기본 테마로 되돌리기
  const handleThemePress = async (t: ShopTheme) => {
    if (buying || !(await requireLogin())) return;
    const server = shop?.itemsByName.get(t.name);
    if (!server) {
      notice(t.name, '아직 판매 준비 중인 테마예요.', t.preview);
      return;
    }
    const themeIds = serverThemeIds(shop!);
    if (isOwned(t)) {
      try {
        await equipTheme(isEquipped(t) ? null : server.id, themeIds);
        await loadShop();
      } catch {
        notice('테마 적용 실패', '잠시 후 다시 시도해 주세요.');
      }
      return;
    }
    purchase({ name: t.name, image: t.preview }, server, () =>
      equipTheme(server.id, themeIds),
    );
  };

  // 아이템: 테마를 가져야 하고, 앞 단계부터 순서대로
  const handleItemPress = async (
    t: ShopTheme,
    item: ShopItem,
    index: number,
  ) => {
    if (buying || !(await requireLogin())) return;
    const owned = shop?.itemsByName.get(item.name);

    // 가진 아이템은 누를 때마다 적용 ↔ 해제.
    // 배경 그림이 "앞에서부터 n개를 놓은 모습"이라 중간을 비울 수 없어서,
    // 적용은 다음 차례(appliedCount)만, 해제는 마지막(appliedCount - 1)만 된다.
    if (owned && isOwned(item)) {
      const applied = appliedItemCount(t, shop!);
      const canApply = index === applied;
      const canRemove = index === applied - 1;
      if (!canApply && !canRemove) {
        notice(
          item.name,
          index < applied
            ? '뒤에 놓은 것부터 차례대로 빼야 해요.'
            : '앞 단계부터 차례대로 놓아야 해요.',
          item.thumbnail,
        );
        return;
      }
      try {
        await equipItem(owned.id, canApply);
        await loadShop();
      } catch {
        notice('바꾸지 못했어요', '잠시 후 다시 시도해 주세요.', item.thumbnail);
      }
      return;
    }

    const server = shop?.itemsByName.get(item.name);
    if (!server) {
      // 서버 items 테이블에 아직 없는 아이템 — BE 에 같은 이름으로 등록돼야 살 수 있다.
      notice(item.name, '아직 판매 준비 중인 아이템이에요.', item.thumbnail);
      return;
    }
    const lock = lockOf(t, index);
    if (lock === 'themeFirst') {
      notice(item.name, `${t.name} 테마를 먼저 구매해야 해요.`, item.thumbnail);
      return;
    }
    if (lock === 'inOrder') {
      const next = t.items[themeProgress(t, shop!).ownedCount];
      notice(
        item.name,
        `${next.name}부터 차례대로 구매해야 해요.`,
        item.thumbnail,
      );
      return;
    }
    // 사면 바로 놓인다 (기존 동작 유지)
    purchase({ name: item.name, image: item.thumbnail }, server, () =>
      equipItem(server.id, true),
    );
  };

  const handleMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = Math.round(e.nativeEvent.contentOffset.x / THEME_COL_W);
      setThemeIndex(Math.max(0, Math.min(shopThemes.length - 1, next)));
    },
    [],
  );

  const handleGridLayout = (e: LayoutChangeEvent) =>
    setGridW(e.nativeEvent.layout.width);

  return (
    <Animated.View
      entering={FadeIn.duration(140)}
      exiting={FadeOut.duration(120)}
      style={[styles.wrapper, style]}
    >
      {/* 꼬리 중심이 상점 버튼 가운데(화면 오른쪽에서 44.5dp)에 오도록 */}
      <View style={[styles.tail, { right: tailRight - 9 }]} />
      <View style={styles.panel}>
        <View style={styles.themeColumn}>
          <Text style={styles.sectionTitle}>테마</Text>
          <FlatList
            ref={listRef}
            data={shopThemes}
            keyExtractor={t => t.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={THEME_COL_W}
            decelerationRate="fast"
            // 첫 그림부터 적용 중인 테마 자리에 그린다 (넘어가는 모습이 안 보인다)
            initialScrollIndex={safeIndex}
            getItemLayout={(_, i) => ({
              length: THEME_COL_W,
              offset: THEME_COL_W * i,
              index: i,
            })}
            onMomentumScrollEnd={handleMomentumEnd}
            renderItem={({ item }) => (
              <ThemeCard
                theme={item}
                price={priceOf(item)}
                owned={isOwned(item)}
                equipped={isEquipped(item)}
                onPress={() => handleThemePress(item)}
              />
            )}
          />
          <View style={styles.dots}>
            {shopThemes.map((t, i) => (
              <View
                key={t.id}
                style={[styles.dot, i === safeIndex && styles.dotActive]}
              />
            ))}
          </View>
        </View>

        <View style={styles.itemColumn}>
          <Text style={styles.sectionTitle}>아이템</Text>
          <View style={styles.grid} onLayout={handleGridLayout}>
            {theme.items.map((item, i) => (
              <ItemCard
                key={item.id}
                item={item}
                size={itemSize}
                price={priceOf(item)}
                owned={isOwned(item)}
                applied={i < appliedCount}
                locked={!isOwned(item) && lockOf(theme, i) !== null}
                onPress={() => handleItemPress(theme, item, i)}
              />
            ))}
          </View>
          {theme.items.length === 0 && (
            <Text style={styles.emptyText}>이 테마엔 아이템이 없어요</Text>
          )}
        </View>
      </View>

      <ConfirmModal
        visible={dialog !== null}
        title={dialog?.title ?? ''}
        message={dialog?.message}
        image={dialog?.image}
        confirmText={dialog?.onConfirm ? dialog.confirmText ?? '확인' : '확인'}
        cancelText={dialog?.onConfirm ? '취소' : null}
        onCancel={() => setDialog(null)}
        onConfirm={async () => {
          if (dialog?.onConfirm) await dialog.onConfirm();
          else setDialog(null);
        }}
      />
    </Animated.View>
  );
}

type CardProps = { price: number; owned: boolean; onPress: () => void };

function ThemeCard({
  theme,
  price,
  owned,
  equipped,
  onPress,
}: { theme: ShopTheme; equipped: boolean } & CardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        owned
          ? `${theme.name} 테마, ${equipped ? '적용 중' : '누르면 적용'}`
          : `${theme.name} 테마, ${price} 코인`
      }
      onPress={onPress}
      style={({ pressed }) => [styles.themeCard, pressed && styles.pressed]}
    >
      {theme.preview ? (
        <Image source={theme.preview} style={styles.fill} resizeMode="cover" />
      ) : (
        <Placeholder label={theme.name} />
      )}
      {/* 가진 테마는 가격 대신, 적용 중이면 표시 (누르면 적용 ↔ 기본 테마) */}
      {!owned && <PriceTag price={price} />}
      {equipped && (
        <View style={styles.equippedBadge}>
          <Text style={styles.equippedText}>적용 중</Text>
        </View>
      )}
    </Pressable>
  );
}

function ItemCard({
  item,
  size,
  price,
  owned,
  applied,
  locked,
  onPress,
}: { item: ShopItem; size: number; locked: boolean; applied: boolean } &
  CardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={owned ? { checked: applied } : undefined}
      accessibilityLabel={
        owned
          ? `${item.name}, ${applied ? '놓음, 누르면 빼기' : '누르면 놓기'}`
          : `${item.name}, ${locked ? '잠김' : `${price} 코인`}`
      }
      onPress={onPress}
      style={({ pressed }) => [
        styles.itemCard,
        { width: size, height: size },
        pressed && styles.pressed,
      ]}
    >
      {item.thumbnail ? (
        <Image
          source={item.thumbnail}
          style={styles.itemImage}
          resizeMode="contain"
        />
      ) : (
        <Placeholder label={item.name} />
      )}
      {/* 가진 아이템은 가격을 숨기고, 아직 못 사는 아이템은 흐리게 + 자물쇠 */}
      {locked && <View style={styles.lockedDim} />}
      {!owned && (locked ? <LockTag /> : <PriceTag price={price} />)}
      {/* 홈에 놓은 아이템 표시 — 다시 누르면 빠진다 */}
      {applied && (
        <View style={styles.appliedBadge}>
          <Text style={styles.appliedCheck}>✓</Text>
        </View>
      )}
    </Pressable>
  );
}

// 에셋 PNG가 들어오기 전까지 쓰는 빈 자리
function Placeholder({ label }: { label: string }) {
  return (
    <View style={styles.placeholder}>
      <Text style={styles.placeholderText} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

function LockTag() {
  return (
    <View style={styles.priceTag}>
      <Text style={styles.lockText}>🔒</Text>
    </View>
  );
}

function PriceTag({ price }: { price: number }) {
  return (
    <View style={styles.priceTag}>
      <Image source={homeImages.coin} style={styles.priceCoin} />
      <Text style={styles.priceText}>{price}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignSelf: 'stretch',
  },
  tail: {
    position: 'absolute',
    top: -7,
    width: 18,
    height: 18,
    backgroundColor: '#FFFFFF',
    transform: [{ rotate: '45deg' }],
    borderRadius: 3,
  },
  panel: {
    flexDirection: 'row',
    gap: GAP,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 14,
    boxShadow: '0px 6px 16px rgba(0,0,0,0.18)',
  },
  themeColumn: {
    width: THEME_COL_W,
  },
  itemColumn: {
    flex: 1,
  },
  sectionTitle: {
    fontFamily: fonts.kkukkukk,
    fontSize: 15,
    color: '#2B2B2B',
    marginBottom: 8,
  },
  themeCard: {
    width: THEME_COL_W,
    height: THEME_CARD_H,
    borderRadius: 12,
    backgroundColor: '#F1EFEA',
    overflow: 'hidden',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
    marginTop: 8,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#D5D5D5',
  },
  dotActive: {
    backgroundColor: '#8DC63F',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
  },
  itemCard: {
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#ECECEC',
    overflow: 'hidden',
    boxShadow: '0px 2px 6px rgba(0,0,0,0.10)',
  },
  pressed: {
    opacity: 0.6,
  },
  appliedBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8DC63F',
  },
  appliedCheck: {
    fontFamily: fonts.kkukkukk,
    fontSize: 12,
    color: '#FFFFFF',
    includeFontPadding: false,
  },
  fill: {
    width: '100%',
    height: '100%',
  },
  // 오른쪽 위 가격표와 겹치지 않게 위쪽을 조금 더 비운다.
  itemImage: {
    position: 'absolute',
    top: 22,
    left: 8,
    right: 8,
    bottom: 8,
    width: undefined,
    height: undefined,
  },
  emptyText: {
    fontFamily: fonts.kkukkukk,
    fontSize: 12,
    color: '#B5B5B5',
    textAlign: 'center',
    marginTop: 40,
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F6F6F4',
    padding: 6,
  },
  placeholderText: {
    fontFamily: fonts.kkukkukk,
    fontSize: 12,
    color: '#B5B5B5',
    textAlign: 'center',
  },
  priceTag: {
    position: 'absolute',
    top: 6,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  lockedDim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  lockText: {
    fontSize: 11,
  },
  equippedBadge: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: '#8DC63F',
  },
  equippedText: {
    fontFamily: fonts.kkukkukk,
    fontSize: 11,
    color: '#FFFFFF',
  },
  priceCoin: {
    width: 14,
    height: 14,
  },
  priceText: {
    fontFamily: fonts.kkukkukk,
    fontSize: 12,
    color: '#5A5A5A',
  },
});
