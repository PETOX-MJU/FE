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
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { homeImages, homePetImages } from '@/assets/images';
import { fetchShopState, type ServerItem } from '@/api/shop';
import { fetchPetSlotLimit } from '@/api/onboarding';
import { supabase } from '@/api/supabase';
import { ConfirmModal } from '@/components/ConfirmModal';
import { useCoinBalance } from '@/hooks/useCoinBalance';
import type { PetId } from '@/constants/onboardingStrings';
import type { LocalPet } from '@/storage/petProfile';
import { fonts } from '@/theme/fonts';

// 홈 버튼에서 위로 펼쳐지는 펫 슬롯 말풍선 패널 (꼬리가 아래 가운데를 가리킨다).
// 칸은 가로 한 줄로 두고 옆으로 밀어서 넘겨 본다 — 슬롯이 늘어나도 패널 높이는 그대로다.
//
// 칸 순서: [키우는 펫들] → [열렸지만 빈 칸(카메라)] → [잠긴 칸(자물쇠·값)] → 마지막 추가(+) 칸.
// 몇 칸이 열렸는지는 서버 profiles.pet_slot_limit (기본 1). 상점의 pet_slot 아이템을
// buy_item 으로 사면 서버가 1씩 올린다 (보유 아이템으로 남지 않고 몇 번이든 살 수 있다).
// 새 펫 등록은 온보딩 캐릭터 화면을 "추가 모드"로 다시 쓴다 — 기존 펫은 덮어쓰지 않는다.

/** 최소로 그리는 슬롯 칸 수 (+ 칸은 따로) */
const MIN_SLOTS = 4;
const GAP = 10;
/** 한 화면에 보이는 칸 수 — 나머지는 옆으로 밀어서 본다 */
const VISIBLE = 2;

// 아직 안 열린 슬롯에 흐리게 비쳐 보이는 펫 — "이런 친구를 더 키울 수 있어요" 미리보기.
// 실제로 그 펫이 배정된다는 뜻은 아니다.
//
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
/** 잠긴 칸 미리보기 후보 — 이미 키우는 견종은 빼고 돌려 쓴다 */
const LOCKED_PREVIEW: { breed: PetId; preview: Preview }[] = [
  { breed: 'golden', preview: GOLDEN_PREVIEW },
  { breed: 'husky', preview: { source: homePetImages.husky } },
  { breed: 'dachshund', preview: { source: homePetImages.dachshund } },
  { breed: 'corgi', preview: { source: homePetImages.corgi } },
];

/** 키우는 펫과 겹치지 않는 미리보기 목록 (다 겹치면 전부) */
function lockedPreviews(pets: LocalPet[]): Preview[] {
  const owned = new Set(pets.map(p => p.pet).filter(Boolean));
  const rest = LOCKED_PREVIEW.filter(c => !owned.has(c.breed));
  return (rest.length > 0 ? rest : LOCKED_PREVIEW).map(c => c.preview);
}

/** 키우는 펫 한 마리의 칸 그림 */
function previewOf(p: LocalPet, fallback: ImageSourcePropType): Preview {
  if (p.generatedUri) return { source: { uri: p.generatedUri } };
  if (p.pet === 'golden') return GOLDEN_PREVIEW;
  if (p.pet) return { source: homePetImages[p.pet] };
  return { source: fallback };
}

/** 새 펫을 확정할 때 함께 살 펫 슬롯 */
export type SlotPurchase = { itemId: string; price: number };

type Cell =
  | { kind: 'pet'; pet: LocalPet }
  | { kind: 'empty'; index: number }
  | { kind: 'locked'; index: number }
  | { kind: 'add' };

type Props = {
  /** 지금 홈에 나와 있는 펫 그림 (그림 정보가 없는 펫의 대체 그림) */
  petSource: ImageSourcePropType;
  /** 키우는 펫 목록 */
  pets: LocalPet[];
  /** 지금 홈에 나와 있는 펫 */
  activeId?: string;
  /** 다른 펫을 홈에 내보낸다 */
  onSelectPet?: (id: string) => void;
  /** 새 펫 등록 화면으로 — 잠긴 칸에서 왔으면 확정 때 살 슬롯(slot)도 같이 */
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

  // 열린 칸 수 — 서버 한도가 늦게 오거나 예전 기기 저장값이 더 많아도 키우는 펫은 다 보이게
  const unlocked = Math.max(limit, pets.length);
  const slotCount = Math.max(MIN_SLOTS, unlocked + 1);
  const slotPrice = slotItem?.price;
  const previews = lockedPreviews(pets);

  const requireLogin = async () => {
    const { data: auth } = await supabase.auth.getSession();
    if (auth.session) return true;
    notice('로그인이 필요해요', '로그인하면 펫 슬롯을 늘릴 수 있어요.');
    return false;
  };

  /** 새 펫 등록 화면으로. 잠긴 칸에서 왔으면 확정할 때 살 슬롯을 같이 넘긴다 */
  const startAdd = (slot?: SlotPurchase) => {
    setDialog(null);
    onAddPet?.(slot);
  };

  /**
   * 잠긴 칸 — 여기서는 코인을 쓰지 않고 펫 추가 화면으로만 보낸다.
   * 코인(buy_item)은 새 펫을 확정하는 순간에 빠진다 — 중간에 나가면 아무것도 안 산 것.
   * 서버 상점에 pet_slot 이 아직 없으면 코인 없이 열어 주지 않고 "준비 중"으로 안내한다.
   */
  const handleUnlock = async () => {
    if (!(await requireLogin())) return;
    if (!slotItem || slotPrice === undefined) {
      notice('준비 중이에요', '펫 슬롯은 곧 상점에 열려요.');
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

  /** + 칸 — 빈 칸이 있으면 바로 등록, 없으면 잠금 해제부터 */
  const handleAdd = () => {
    if (pets.length < unlocked) startAdd();
    else handleUnlock();
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
    ...Array.from({ length: slotCount - pets.length }, (_, k) => {
      const index = pets.length + k;
      return index < unlocked
        ? { kind: 'empty' as const, index }
        : { kind: 'locked' as const, index };
    }),
    { kind: 'add' as const },
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
            keyExtractor={c =>
              c.kind === 'add'
                ? 'add'
                : c.kind === 'pet'
                ? c.pet.id
                : `${c.kind}-${c.index}`
            }
            horizontal
            showsHorizontalScrollIndicator={false}
            // 칸 하나씩 딱 맞게 멈춘다
            snapToInterval={cellSize + GAP}
            decelerationRate="fast"
            ItemSeparatorComponent={Separator}
            renderItem={({ item }) => {
              switch (item.kind) {
                case 'pet':
                  return (
                    <SlotCell
                      size={cellSize}
                      mine={item.pet.id === activeId}
                      label={item.pet.name}
                      preview={previewOf(item.pet, petSource)}
                      locked={false}
                      onPress={() => handlePetPress(item.pet)}
                    />
                  );
                case 'empty':
                  return (
                    <EmptyCell size={cellSize} onPress={() => startAdd()} />
                  );
                case 'locked':
                  return (
                    <SlotCell
                      size={cellSize}
                      mine={false}
                      preview={
                        previews[(item.index - unlocked) % previews.length]
                      }
                      locked
                      price={slotPrice}
                      onPress={handleUnlock}
                    />
                  );
                case 'add':
                  return (
                    <AddCell
                      size={cellSize}
                      price={pets.length < unlocked ? undefined : slotPrice}
                      onPress={handleAdd}
                    />
                  );
              }
            }}
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

/** 자물쇠 폭이 칸에서 차지하는 비율 (그려지는 부분 기준 ≈ 32%) */
const LOCK_RATIO = 0.34;

/** 잠긴 슬롯 가운데 얹는 흰 자물쇠 — 속이 비어 펫이 비쳐 보인다 */
function LockMark({ size }: { size: number }) {
  const w = Math.round(size * LOCK_RATIO);
  return (
    <Svg width={w} height={(w * 39) / 32} viewBox="0 0 32 39">
      {/* 고리 */}
      <Path
        d="M8.5 18V12.5a7.5 7.5 0 0 1 15 0V18"
        stroke="#FFFFFF"
        strokeWidth={3.2}
        strokeLinecap="round"
        fill="none"
      />
      {/* 몸통 — 채우지 않아 뒤의 펫이 비친다 */}
      <Rect
        x={2.5}
        y={18}
        width={27}
        height={18.5}
        rx={4.5}
        stroke="#FFFFFF"
        strokeWidth={3.2}
        fill="none"
      />
    </Svg>
  );
}

/** 칸 사이 간격 (FlatList 는 gap 대신 구분자로 준다) */
function Separator() {
  return <View style={styles.separator} />;
}

/** 그림이 칸에서 차지하는 기본 크기 */
const IMAGE_RATIO = 0.84;

function SlotCell({
  size,
  mine,
  label,
  preview,
  locked,
  price,
  onPress,
}: {
  size: number;
  /** 지금 홈에 나와 있는 펫 칸 */
  mine: boolean;
  /** 키우는 펫 이름 — 있으면 칸 아래에 적는다 */
  label?: string;
  preview: Preview;
  locked: boolean;
  /** 잠긴 칸에 보여 줄 잠금 해제 값 */
  price?: number;
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
      accessibilityLabel={
        label !== undefined
          ? `${label}${mine ? ', 지금 함께하는 펫' : ''}`
          : locked
          ? `잠긴 펫 슬롯${price !== undefined ? `, ${price} 코인` : ''}`
          : '빈 펫 슬롯'
      }
      onPress={onPress}
      style={({ pressed }) => [
        styles.cell,
        { width: size, height: size },
        mine
          ? styles.cellMine
          : label !== undefined
          ? styles.cellOwned
          : styles.cellEmpty,
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
      {locked && (
        <>
          {/* 칸 전체를 어둡게 — 흰 자물쇠와 값이 또렷하게 보이도록 */}
          <View style={styles.lockedDim} pointerEvents="none" />
          <View style={styles.lockLayer} pointerEvents="none">
            <LockMark size={size} />
          </View>
          {price !== undefined && (
            <View style={styles.priceTag} pointerEvents="none">
              <Image source={homeImages.coin} style={styles.priceCoin} />
              <Text style={styles.priceText}>{price}</Text>
            </View>
          )}
        </>
      )}
      {label !== undefined && (
        <Text style={styles.petLabel} numberOfLines={1} pointerEvents="none">
          {label}
        </Text>
      )}
    </Pressable>
  );
}

/**
 * 잠금은 풀렸지만 아직 펫이 없는 칸 — 밝은 점선 칸에 + 와 안내 문구.
 * 카메라 칸(맨 끝 추가 칸)과 헷갈리지 않게 모양을 다르게 둔다.
 */
function EmptyCell({ size, onPress }: { size: number; onPress: () => void }) {
  const plus = Math.round(size * 0.22);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="빈 펫 슬롯, 새 친구 데려오기"
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
    </Pressable>
  );
}

/** 카메라 아이콘 폭이 칸에서 차지하는 비율 */
const CAMERA_RATIO = 0.42;

/** 사진으로 펫 등록 — 자물쇠와 같은 선 굵기·색의 테두리 아이콘 */
function CameraMark({ size }: { size: number }) {
  const w = Math.round(size * CAMERA_RATIO);
  return (
    <Svg width={w} height={(w * 28) / 36} viewBox="0 0 36 28">
      {/* 위쪽 볼록한 부분 */}
      <Path
        d="M12.5 5.5 14.5 2h7l2 3.5"
        stroke="#FFFFFF"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* 몸통 */}
      <Rect
        x={1.7}
        y={5.5}
        width={32.6}
        height={20.8}
        rx={4.5}
        stroke="#FFFFFF"
        strokeWidth={2.4}
        fill="none"
      />
      {/* 렌즈 */}
      <Circle
        cx={18}
        cy={16}
        r={6}
        stroke="#FFFFFF"
        strokeWidth={2.4}
        fill="none"
      />
      {/* 플래시 */}
      <Circle cx={28.5} cy={10.5} r={1.4} fill="#FFFFFF" />
    </Svg>
  );
}

function AddCell({
  size,
  price,
  onPress,
}: {
  size: number;
  /** 잠금 해제 값 — 빈 칸이 이미 열려 있으면 없음 */
  price?: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        price !== undefined ? `새 펫 추가, ${price} 코인` : '새 펫 추가'
      }
      onPress={onPress}
      style={({ pressed }) => [
        styles.cell,
        { width: size, height: size },
        styles.cellEmpty,
        pressed && styles.pressed,
      ]}
    >
      {/* 잠긴 칸과 같은 음영 — 흰 카메라와 값이 또렷하게 보이도록 */}
      <View style={styles.lockedDim} pointerEvents="none" />
      <CameraMark size={size} />
      {price !== undefined && (
        <View style={styles.priceTag} pointerEvents="none">
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
  // 잠긴 칸 오른쪽 위 — 이 슬롯을 여는 값
  priceTag: {
    position: 'absolute',
    top: 6,
    right: 8,
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
    color: '#FFFFFF',
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
  cellOwned: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#EEEEEE',
  },
  // 열린 빈 칸 — 점선 테두리
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
  cellEmpty: {
    backgroundColor: '#ECECEC',
  },
  lockedDim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.27)',
  },
  lockLayer: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },

  pressed: {
    opacity: 0.6,
  },
});
