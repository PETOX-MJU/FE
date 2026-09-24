import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
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
  equipTheme,
  fetchShopState,
  notifyShopChanged,
  type ServerItem,
  type ShopRule,
  type ShopState,
} from '@/api/shop';
import {
  itemLock,
  serverThemeIds,
  themeProgress,
} from '@/features/shop/progress';
import { supabase } from '@/api/supabase';
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

type Props = {
  // 말풍선 꼬리가 가리킬 위치 — 패널 오른쪽 끝에서 꼬리 중심까지의 거리
  tailRight?: number;
  style?: StyleProp<ViewStyle>;
};

// 상점 버튼에서 펼쳐지는 말풍선 패널.
// 왼쪽은 테마(좌우로 넘김), 오른쪽은 그 테마에 속한 아이템 4개.
export function ShopPanel({ tailRight = 27, style }: Props) {
  const [themeIndex, setThemeIndex] = useState(0);
  const [gridW, setGridW] = useState(0);
  const listRef = useRef<FlatList<ShopTheme>>(null);

  // 테마 목록이 줄어들어도(빌드 중 Fast Refresh, 서버 목록 변경 등) 범위를 벗어나지 않게 맞춘다.
  const safeIndex = Math.min(themeIndex, shopThemes.length - 1);
  const theme = shopThemes[safeIndex];
  const itemSize = gridW > 0 ? (gridW - GAP) / 2 : 0;

  // 서버 카탈로그(가격·uuid)와 내 보유 목록. 패널이 열릴 때마다 새로 읽는다.
  const [shop, setShop] = useState<ShopState | null>(null);
  const [buying, setBuying] = useState(false);
  const { coins } = useCoinBalance();

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

  const requireLogin = async () => {
    const { data: auth } = await supabase.auth.getSession();
    if (auth.session) return true;
    Alert.alert(
      '로그인이 필요해요',
      '로그인하면 코인으로 아이템을 살 수 있어요.',
    );
    return false;
  };

  /** 확인 → 서버 구매 → 잔액·상점·홈 배경 갱신. 성공하면 onBought 실행. */
  const purchase = (
    entry: { name: string },
    server: ServerItem,
    onBought?: () => Promise<void>,
  ) => {
    const balance = coins ?? 0;
    if (balance < server.price) {
      Alert.alert(
        '코인이 부족해요',
        `${server.price}코인이 필요해요. (지금 ${balance}코인)`,
      );
      return;
    }
    Alert.alert(
      '구매할까요?',
      `${entry.name}을(를) ${server.price}코인에 구매할까요?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '구매',
          onPress: async () => {
            setBuying(true);
            try {
              await buyItem(server.id);
              await onBought?.();
              Alert.alert('구매 완료', `${entry.name}을(를) 샀어요!`);
            } catch (e) {
              if (e instanceof NotEnoughCoinsError) {
                Alert.alert(
                  '코인이 부족해요',
                  '잔액이 바뀌었어요. 다시 확인해 주세요.',
                );
              } else if (e instanceof ShopRuleError) {
                Alert.alert(entry.name, RULE_TEXT[e.rule]);
              } else {
                Alert.alert('구매 실패', '잠시 후 다시 시도해 주세요.');
              }
            } finally {
              notifyCoinsChanged();
              notifyShopChanged();
              await loadShop();
              setBuying(false);
            }
          },
        },
      ],
    );
  };

  // 테마: 안 가졌으면 구매(사면 바로 적용), 가졌으면 적용 ↔ 기본 테마로 되돌리기
  const handleThemePress = async (t: ShopTheme) => {
    if (buying || !(await requireLogin())) return;
    const server = shop?.itemsByName.get(t.name);
    if (!server) {
      Alert.alert(t.name, '아직 판매 준비 중인 테마예요.');
      return;
    }
    const themeIds = serverThemeIds(shop!);
    if (isOwned(t)) {
      try {
        await equipTheme(isEquipped(t) ? null : server.id, themeIds);
        await loadShop();
      } catch {
        Alert.alert('테마 적용 실패', '잠시 후 다시 시도해 주세요.');
      }
      return;
    }
    purchase(t, server, () => equipTheme(server.id, themeIds));
  };

  // 아이템: 테마를 가져야 하고, 앞 단계부터 순서대로
  const handleItemPress = async (
    t: ShopTheme,
    item: ShopItem,
    index: number,
  ) => {
    if (buying || !(await requireLogin())) return;
    if (isOwned(item)) {
      Alert.alert(item.name, '이미 가지고 있어요.');
      return;
    }
    const server = shop?.itemsByName.get(item.name);
    if (!server) {
      // 서버 items 테이블에 아직 없는 아이템 — BE 에 같은 이름으로 등록돼야 살 수 있다.
      Alert.alert(item.name, '아직 판매 준비 중인 아이템이에요.');
      return;
    }
    const lock = lockOf(t, index);
    if (lock === 'themeFirst') {
      Alert.alert(item.name, `${t.name} 테마를 먼저 구매해야 해요.`);
      return;
    }
    if (lock === 'inOrder') {
      const next = t.items[themeProgress(t, shop!).ownedCount];
      Alert.alert(item.name, `${next.name}부터 차례대로 구매해야 해요.`);
      return;
    }
    purchase(item, server);
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
  locked,
  onPress,
}: { item: ShopItem; size: number; locked: boolean } & CardProps) {
  // TODO: 배치(홈 화면에 놓기)는 아직 없다.
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${locked ? '잠김' : `${price} 코인`}`}
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
