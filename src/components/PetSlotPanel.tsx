import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { homeImages, homePetImages } from '@/assets/images';
import { fetchShopState, type ServerItem } from '@/api/shop';
import { fetchPetSlotLimit } from '@/api/onboarding';
import { supabase } from '@/api/supabase';
import { ConfirmModal } from '@/components/ConfirmModal';
import { useCoinBalance } from '@/hooks/useCoinBalance';
import type { LocalPet } from '@/storage/petProfile';
import { fonts } from '@/theme/fonts';

// 홈 버튼에서 위로 펼쳐지는 펫 슬롯 말풍선 패널 (꼬리가 아래 가운데를 가리킨다).
// 칸은 가로 한 줄로 두고 옆으로 밀어서 넘겨 본다 — 펫이 늘어나도 패널 높이는 그대로다.
//
// 칸 순서: [키우는 펫들] → 맨 끝에 "새 친구" 칸 하나.
// 새 친구 칸을 누르면 펫 추가 화면으로 간다. 이미 사 둔 빈 슬롯이 있으면 무료,
// 없으면 칸에 슬롯 값(코인)을 보여 주고, 코인은 새 펫을 확정하는 순간에 빠진다.
// 몇 칸까지 키울 수 있는지는 서버 profiles.pet_slot_limit (기본 1). 상점의 pet_slot 아이템을
// buy_item 으로 사면 서버가 1씩 올린다 (보유 아이템으로 남지 않고 몇 번이든 살 수 있다).

const GAP = 10;
/** 한 화면에 보이는 칸 수 — 나머지는 옆으로 밀어서 본다 */
const VISIBLE = 2;

// 골든만 그림이 240 × 262 라 캔버스 위 25% 가 투명하게 비어 있다. contain 은 캔버스 기준으로
// 맞추니 그대로 두면 다른 펫보다 작게 그려져서, 확대해서 크기를 맞춘다 (비율은 그대로).
type Preview = {
  source: ImageSourcePropType;
  /** 캔버스 위쪽 투명 여백 비율 — 확대한 만큼 위로 올려 세로 가운데를 맞추는 데 쓴다 */
  topPad?: number;
  /** 기본 크기 대비 확대 배율 */
  scale?: number;
  /** 왼쪽으로 옮기는 양 (칸 크기 대비 비율) */
  shiftX?: number;
};
const GOLDEN_PREVIEW: Preview = {
  source: homePetImages.golden,
  topPad: 1 - 262 / 350,
  scale: 1.28,
  shiftX: 0.05,
};

/** 키우는 펫 한 마리의 칸 그림 */
function previewOf(p: LocalPet, fallback: ImageSourcePropType): Preview {
  if (p.generatedUri) return { source: { uri: p.generatedUri } };
  if (p.pet === 'golden') return GOLDEN_PREVIEW;
  if (p.pet) return { source: homePetImages[p.pet] };
  return { source: fallback };
}

/** 새 펫을 확정할 때 함께 살 펫 슬롯 */
export type SlotPurchase = { itemId: string; price: number };

type Cell = { kind: 'pet'; pet: LocalPet } | { kind: 'new' };

type Props = {
  /** 지금 홈에 나와 있는 펫 그림 (그림 정보가 없는 펫의 대체 그림) */
  petSource: ImageSourcePropType;
  /** 키우는 펫 목록 */
  pets: LocalPet[];
  /** 지금 홈에 나와 있는 펫 */
  activeId?: string;
  /** 다른 펫을 홈에 내보낸다 */
  onSelectPet?: (id: string) => void;
  /** 새 펫 등록 화면으로 — 빈 슬롯이 없으면 확정 때 살 슬롯(slot)도 같이 */
  onAddPet?: (slot?: SlotPurchase) => void;
  style?: StyleProp<ViewStyle>;
};

export function PetSlotPanel({
  petSource,
  pets,
  activeId,
  onSelectPet,
  onAddPet,
  style,
}: Props) {
  const [limit, setLimit] = useState(1);
  const [slotItem, setSlotItem] = useState<ServerItem | null>(null);
  const { coins } = useCoinBalance();
  // 칸은 정사각형 — 보이는 너비에서 VISIBLE 개가 딱 들어가게 계산한다
  const [gridW, setGridW] = useState(0);
  const cellSize =
    gridW > 0 ? Math.floor((gridW - GAP * (VISIBLE - 1)) / VISIBLE) : 0;

  type Dialog = {
    title: string;
    message?: string;
    image?: ImageSourcePropType;
    confirmText?: string;
    onConfirm?: () => Promise<void>;
  };
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const notice = (
    title: string,
    message?: string,
    image?: ImageSourcePropType,
  ) => setDialog({ title, message, image });

  const load = useCallback(async () => {
    try {
      const [lim, shop] = await Promise.all([
        fetchPetSlotLimit(),
        fetchShopState(),
      ]);
      setLimit(lim);
      // 서버 상점의 pet_slot 아이템 (여러 개면 가장 싼 것)
      const items = [...shop.itemsByName.values()]
        .filter(i => i.type === 'pet_slot')
        .sort((a, b) => a.price - b.price);
      setSlotItem(items[0] ?? null);
    } catch (e) {
      console.warn('펫 슬롯 정보를 불러오지 못했어요', e);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** 이미 사 둔 빈 슬롯이 있는가 — 있으면 새 친구는 무료 */
  const hasFreeSlot = pets.length < limit;
  const slotPrice = slotItem?.price;

  const requireLogin = async () => {
    const { data: auth } = await supabase.auth.getSession();
    if (auth.session) return true;
    notice('로그인이 필요해요', '로그인하면 새 친구를 데려올 수 있어요.');
    return false;
  };

  /** 새 펫 등록 화면으로. 슬롯을 사야 하면 확정할 때 살 슬롯을 같이 넘긴다 */
  const startAdd = (slot?: SlotPurchase) => {
    setDialog(null);
    onAddPet?.(slot);
  };

  /**
   * 새 친구 칸 — 여기서는 코인을 쓰지 않고 펫 추가 화면으로만 보낸다.
   * 코인(buy_item)은 새 펫을 확정하는 순간에 빠진다 — 중간에 나가면 아무것도 안 산 것.
   * 서버 상점에 pet_slot 이 아직 없으면 코인 없이 열어 주지 않고 "준비 중"으로 안내한다.
   */
  const handleNew = async () => {
    if (!(await requireLogin())) return;
    if (hasFreeSlot) {
      startAdd();
      return;
    }
    if (!slotItem || slotPrice === undefined) {
      notice('준비 중이에요', '새 친구 슬롯은 곧 열려요.');
      return;
    }
    if ((coins ?? 0) < slotPrice) {
      notice(
        '코인이 부족해요',
        `새 친구를 데려오려면 ${slotPrice}코인이 필요해요.`,
      );
      return;
    }
    setDialog({
      title: '새 친구를 데려올까요?',
      message: `펫을 만들 때 ${slotPrice}코인이 빠져요.`,
      confirmText: '데려오기',
      onConfirm: async () =>
        startAdd({ itemId: slotItem.id, price: slotPrice }),
    });
  };

  const handlePetPress = (p: LocalPet) => {
    if (p.id === activeId) {
      notice(
        p.name,
        '지금 함께 지내고 있는 펫이에요.',
        previewOf(p, petSource).source,
      );
      return;
    }
    setDialog({
      title: p.name,
      message: '이 친구와 함께할까요?\n홈과 화면 위에 이 친구가 나와요.',
      image: previewOf(p, petSource).source,
      confirmText: '바꾸기',
      onConfirm: async () => {
        setDialog(null);
        onSelectPet?.(p.id);
      },
    });
  };

  const cells: Cell[] = [
    ...pets.map(pet => ({ kind: 'pet' as const, pet })),
    { kind: 'new' as const },
  ];

  return (
    <Animated.View
      entering={FadeIn.duration(140)}
      exiting={FadeOut.duration(120)}
      style={[styles.wrapper, style]}
    >
      <View style={styles.panel}>
        <View style={styles.header}>
          <Text style={styles.title}>펫 슬롯</Text>
        </View>

        <View onLayout={e => setGridW(e.nativeEvent.layout.width)}>
          <FlatList
            data={cells}
            keyExtractor={c => (c.kind === 'new' ? 'new' : c.pet.id)}
            horizontal
            showsHorizontalScrollIndicator={false}
            // 칸 하나씩 딱 맞게 멈춘다
            snapToInterval={cellSize + GAP}
            decelerationRate="fast"
            ItemSeparatorComponent={Separator}
            renderItem={({ item }) =>
              item.kind === 'pet' ? (
                <PetCell
                  size={cellSize}
                  mine={item.pet.id === activeId}
                  label={item.pet.name}
                  preview={previewOf(item.pet, petSource)}
                  onPress={() => handlePetPress(item.pet)}
                />
              ) : (
                <NewFriendCell
                  size={cellSize}
                  price={hasFreeSlot ? undefined : slotPrice}
                  onPress={handleNew}
                />
              )
            }
          />
        </View>
      </View>

      {/* 꼬리는 아래 가운데 — 홈 버튼을 가리킨다 */}
      <View style={styles.tail} />

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

/** 칸 사이 간격 (FlatList 는 gap 대신 구분자로 준다) */
function Separator() {
  return <View style={styles.separator} />;
}

/** 그림이 칸에서 차지하는 기본 크기 */
const IMAGE_RATIO = 0.84;

/** 키우는 펫 칸 — 그림 + 아래 이름. 지금 홈에 나와 있는 펫은 초록 테두리 */
function PetCell({
  size,
  mine,
  label,
  preview,
  onPress,
}: {
  size: number;
  mine: boolean;
  label: string;
  preview: Preview;
  onPress: () => void;
}) {
  // 확대한 그림은 위 여백의 절반만큼 올려야 "그려진 부분"이 세로 가운데에 온다.
  const topPad = preview.topPad ?? 0;
  const base = size * IMAGE_RATIO;
  const box = base * (preview.scale ?? 1);
  const lift = (box * topPad) / 2;
  const shift = size * (preview.shiftX ?? 0);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}${mine ? ', 지금 함께하는 펫' : ''}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.cell,
        { width: size, height: size },
        mine ? styles.cellMine : styles.cellOwned,
        pressed && styles.pressed,
      ]}
    >
      <Image
        source={preview.source}
        resizeMode="contain"
        style={{
          width: box,
          height: box,
          transform: [{ translateX: -shift }, { translateY: -lift }],
        }}
      />
      <Text style={styles.petLabel} numberOfLines={1} pointerEvents="none">
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * 맨 끝 "새 친구" 칸 — 밝은 점선 칸에 + 와 안내 문구, 그 아래 값(코인).
 * 이미 사 둔 빈 슬롯이 있으면 값 없이 보여 준다.
 */
function NewFriendCell({
  size,
  price,
  onPress,
}: {
  size: number;
  price?: number;
  onPress: () => void;
}) {
  const plus = Math.round(size * 0.22);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        price !== undefined
          ? `새 친구 데려오기, ${price} 코인`
          : '새 친구 데려오기'
      }
      onPress={onPress}
      style={({ pressed }) => [
        styles.cell,
        styles.cellOpen,
        { width: size, height: size },
        pressed && styles.pressed,
      ]}
    >
      <Svg width={plus} height={plus} viewBox="0 0 24 24">
        <Path
          d="M12 3v18M3 12h18"
          stroke="#9CC79A"
          strokeWidth={3}
          strokeLinecap="round"
        />
      </Svg>
      <Text style={styles.openText}>새 친구</Text>
      {price !== undefined && (
        <View style={styles.priceRow} pointerEvents="none">
          <Image source={homeImages.coin} style={styles.priceCoin} />
          <Text style={styles.priceText}>{price}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignSelf: 'stretch',
  },
  panel: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 14,
    boxShadow: '0px 6px 16px rgba(0,0,0,0.18)',
  },
  tail: {
    alignSelf: 'center',
    marginTop: -9,
    width: 18,
    height: 18,
    backgroundColor: '#FFFFFF',
    transform: [{ rotate: '45deg' }],
    borderRadius: 3,
  },
  header: {
    alignItems: 'center',
    marginBottom: 10,
  },
  title: {
    fontFamily: fonts.kkukkukk,
    fontSize: 15,
    color: '#2B2B2B',
  },
  // 새 친구 칸 — 문구 아래 값
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  priceCoin: {
    width: 18,
    height: 18,
  },
  priceText: {
    fontFamily: fonts.kkukkukk,
    fontSize: 15,
    color: '#5A5A5A',
    includeFontPadding: false,
  },
  separator: {
    width: GAP,
  },
  // 너비·높이는 grid 실제 너비에서 계산해 넣는다 (cellSize)
  cell: {
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cellMine: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#9CC79A',
  },
  cellOwned: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#EEEEEE',
  },
  // 키우는 펫 칸 아래 이름
  petLabel: {
    position: 'absolute',
    bottom: 5,
    left: 6,
    right: 6,
    textAlign: 'center',
    fontFamily: fonts.kkukkukk,
    fontSize: 12,
    color: '#5A5A5A',
    includeFontPadding: false,
  },
  // 새 친구 칸 — 점선 테두리
  cellOpen: {
    backgroundColor: '#F6FAF5',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#B9D8B7',
    gap: 6,
  },
  openText: {
    fontFamily: fonts.kkukkukk,
    fontSize: 13,
    color: '#7FAF7C',
    includeFontPadding: false,
  },
  pressed: {
    opacity: 0.6,
  },
});
