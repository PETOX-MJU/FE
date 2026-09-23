import React, { useCallback, useRef, useState } from 'react';
import {
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
import { shopThemes, type ShopItem, type ShopTheme } from '@/data/shop';
import { fonts } from '@/theme/fonts';

const THEME_COL_W = 132; // 테마 카드 한 장 너비
const THEME_CARD_H = 186;
const GAP = 12;

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

  const theme = shopThemes[themeIndex];
  const itemSize = gridW > 0 ? (gridW - GAP) / 2 : 0;

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
            renderItem={({ item }) => <ThemeCard theme={item} />}
          />
          <View style={styles.dots}>
            {shopThemes.map((t, i) => (
              <View
                key={t.id}
                style={[styles.dot, i === themeIndex && styles.dotActive]}
              />
            ))}
          </View>
        </View>

        <View style={styles.itemColumn}>
          <Text style={styles.sectionTitle}>아이템</Text>
          <View style={styles.grid} onLayout={handleGridLayout}>
            {theme.items.map(item => (
              <ItemCard key={item.id} item={item} size={itemSize} />
            ))}
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

function ThemeCard({ theme }: { theme: ShopTheme }) {
  return (
    <View style={styles.themeCard}>
      {theme.preview ? (
        <Image source={theme.preview} style={styles.fill} resizeMode="cover" />
      ) : (
        <Placeholder label={theme.name} />
      )}
      {theme.owned ? (
        <View style={styles.ownedOverlay}>
          <Text style={styles.ownedText}>보유</Text>
        </View>
      ) : (
        <PriceTag price={theme.price} />
      )}
    </View>
  );
}

function ItemCard({ item, size }: { item: ShopItem; size: number }) {
  // TODO: 구매·배치 동작은 아직 없다. 코인 원장이 붙으면 여기서 구매를 처리한다.
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${item.price} 코인`}
      style={({ pressed }) => [
        styles.itemCard,
        { width: size, height: size },
        pressed && styles.pressed,
      ]}
    >
      {item.thumbnail ? (
        <Image
          source={item.thumbnail}
          style={styles.fill}
          resizeMode="contain"
        />
      ) : (
        <Placeholder label={item.name} />
      )}
      {item.owned ? (
        <View style={styles.ownedOverlay}>
          <Text style={styles.ownedText}>보유</Text>
        </View>
      ) : (
        <PriceTag price={item.price} />
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
  priceCoin: {
    width: 14,
    height: 14,
  },
  priceText: {
    fontFamily: fonts.kkukkukk,
    fontSize: 12,
    color: '#5A5A5A',
  },
  // 이미 가지고 있는 테마·아이템 — 카드 전체를 살짝 어둡게 덮고 가운데에 '보유'
  ownedOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.30)',
  },
  ownedText: {
    fontFamily: fonts.kkukkukk,
    fontSize: 14,
    color: '#FFFFFF',
  },
});
