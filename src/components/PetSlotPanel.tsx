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
import {
  NotEnoughCoinsError,
  ShopRuleError,
  buyItem,
  fetchShopState,
  notifyShopChanged,
  type ServerItem,
  type ShopState,
} from '@/api/shop';
import { supabase } from '@/api/supabase';
import { ConfirmModal } from '@/components/ConfirmModal';
import { notifyCoinsChanged, useCoinBalance } from '@/hooks/useCoinBalance';
import { fonts } from '@/theme/fonts';

// 홈 버튼에서 위로 펼쳐지는 펫 슬롯 말풍선 패널 (꼬리가 아래 가운데를 가리킨다).
// 칸은 가로 한 줄로 두고 옆으로 밀어서 넘겨 본다 — 슬롯이 늘어나도 패널 높이는 그대로다.
// 1번 칸은 지금 키우는 펫, 나머지는 아직 안 열린 슬롯, 마지막 칸은 슬롯 추가(+).
// 슬롯은 서버 상점의 pet_slot 아이템을 코인으로 사서 연다 — 몇 개를 샀는지가 곧 열린 슬롯 수다.

/** 화면에 그리는 슬롯 칸 수 (+ 칸은 따로) */
const SLOT_COUNT = 4;
const GAP = 10;
/** 한 화면에 보이는 칸 수 — 나머지는 옆으로 밀어서 본다 */
const VISIBLE = 2;
/** 슬롯 하나를 여는 값. 서버 items 에 pet_slot 이 등록되면 서버 가격이 우선이다. */
const SLOT_PRICE = 500;

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
const LOCKED_PREVIEW: Preview[] = [
  {
    source: homePetImages.golden,
    topPad: 1 - 262 / 350,
    scale: 1.28,
    shiftX: 0.05,
  },
  { source: homePetImages.dachshund },
  { source: homePetImages.husky },
];

type Cell = { kind: 'slot'; index: number } | { kind: 'add' };

type Props = {
  /** 지금 키우는 펫 그림 (홈 화면과 같은 것) */
  petSource: ImageSourcePropType;
  petName?: string;
  /** 잠금을 푼 뒤 — 회원가입 때와 같은 사진 등록 화면으로 보낸다 */
  onAddPet?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function PetSlotPanel({ petSource, petName, onAddPet, style }: Props) {
  const [shop, setShop] = useState<ShopState | null>(null);
  const [buying, setBuying] = useState(false);
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

  const loadShop = useCallback(async () => {
    try {
      setShop(await fetchShopState());
    } catch (e) {
      console.warn('펫 슬롯 정보를 불러오지 못했어요', e);
    }
  }, []);

  useEffect(() => {
    loadShop();
  }, [loadShop]);

  // 서버 상점의 pet_slot 아이템들. 싼 것부터 = 먼저 열리는 슬롯.
  const slotItems: ServerItem[] = shop
    ? [...shop.itemsByName.values()]
        .filter(i => i.type === 'pet_slot')
        .sort((a, b) => a.price - b.price)
    : [];
  const boughtSlots = slotItems.filter(i => shop?.ownedIds.has(i.id)).length;
  // BE 는 계정당 펫 1마리가 기본이고, 산 슬롯만큼 늘어난다 (api/onboarding.ts 주석)
  const unlocked = 1 + boughtSlots;
  const nextSlot = slotItems.find(i => !shop?.ownedIds.has(i.id));
  // 칸에 보여 줄 값 — 서버에 등록돼 있으면 서버 가격이 기준 (상점과 같은 규칙)
  const slotPrice = nextSlot?.price ?? SLOT_PRICE;

  const requireLogin = async () => {
    const { data: auth } = await supabase.auth.getSession();
    if (auth.session) return true;
    notice('로그인이 필요해요', '로그인하면 펫 슬롯을 늘릴 수 있어요.');
    return false;
  };

  /**
   * 잠금 해제 — 코인이 넉넉하면 안내 팝업, 모자라면 부족하다고 알린다.
   * 확인을 누르면 서버 buy_item 으로 실제 구매한다 (최종 판단은 언제나 서버).
   */
  const handleAdd = async () => {
    if (buying || !(await requireLogin())) return;
    if (unlocked > SLOT_COUNT) {
      notice('슬롯이 가득 찼어요', '지금은 여기까지 늘릴 수 있어요.');
      return;
    }
    const balance = coins ?? 0;
    if (balance < slotPrice) {
      notice('코인이 부족해요', `잠금을 풀려면 ${slotPrice}코인이 필요해요.`);
      return;
    }
    setDialog({
      title: '슬롯 잠금을 풀까요?',
      message: `${slotPrice}코인을 써서 펫을 한 마리 더 키울 수 있어요.`,
      confirmText: '잠금 해제',
      onConfirm: async () => {
        // 서버 상점에 pet_slot 이 등록돼 있으면 실제로 산다.
        // 아직 없으면(= 화면에만 값이 보이는 상태) 코인은 건드리지 않고 넘어간다.
        if (nextSlot) {
          let failure: Dialog | null = null;
          setBuying(true);
          try {
            await buyItem(nextSlot.id);
          } catch (e) {
            if (e instanceof NotEnoughCoinsError) {
              failure = {
                title: '코인이 부족해요',
                message: '잔액이 바뀌었어요. 다시 확인해 주세요.',
              };
            } else if (e instanceof ShopRuleError) {
              failure = { title: '펫 슬롯', message: '이미 열린 슬롯이에요.' };
            } else {
              failure = {
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
          if (failure) {
            setDialog(failure);
            return;
          }
        }
        setDialog(null);
        onAddPet?.();
      },
    });
  };

  // 슬롯 칸들 + 마지막 추가(+) 칸
  const cells: Cell[] = [
    ...Array.from({ length: SLOT_COUNT }, (_, index) => ({
      kind: 'slot' as const,
      index,
    })),
    { kind: 'add' as const },
  ];

  const handleSlotPress = (index: number) => {
    if (index === 0) {
      notice(petName ?? '내 펫', '지금 함께 지내고 있는 펫이에요.', petSource);
      return;
    }
    if (index < unlocked) {
      // 슬롯은 열렸는데 아직 두 번째 펫을 등록하는 흐름이 없다 (온보딩이 1마리 기준)
      notice('빈 슬롯', '새 펫 등록은 곧 열려요.');
      return;
    }
    handleAdd();
  };

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
            keyExtractor={c => (c.kind === 'add' ? 'add' : String(c.index))}
            horizontal
            showsHorizontalScrollIndicator={false}
            // 칸 하나씩 딱 맞게 멈춘다
            snapToInterval={cellSize + GAP}
            decelerationRate="fast"
            ItemSeparatorComponent={Separator}
            renderItem={({ item }) =>
              item.kind === 'add' ? (
                <AddCell
                  size={cellSize}
                  price={slotPrice}
                  onPress={handleAdd}
                />
              ) : (
                <SlotCell
                  size={cellSize}
                  mine={item.index === 0}
                  preview={
                    item.index === 0
                      ? { source: petSource }
                      : LOCKED_PREVIEW[(item.index - 1) % LOCKED_PREVIEW.length]
                  }
                  locked={item.index >= unlocked}
                  price={slotPrice}
                  onPress={() => handleSlotPress(item.index)}
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
  preview,
  locked,
  price,
  onPress,
}: {
  size: number;
  mine: boolean;
  preview: Preview;
  locked: boolean;
  /** 잠긴 칸에 보여 줄 잠금 해제 값 */
  price: number;
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
        mine
          ? '내 펫'
          : locked
          ? `잠긴 펫 슬롯, ${price} 코인`
          : '빈 펫 슬롯'
      }
      onPress={onPress}
      style={({ pressed }) => [
        styles.cell,
        { width: size, height: size },
        mine ? styles.cellMine : styles.cellEmpty,
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
          <View style={styles.priceTag} pointerEvents="none">
            <Image source={homeImages.coin} style={styles.priceCoin} />
            <Text style={styles.priceText}>{price}</Text>
          </View>
        </>
      )}
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
  price: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`사진으로 펫 추가, ${price} 코인`}
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
      <View style={styles.priceTag} pointerEvents="none">
        <Image source={homeImages.coin} style={styles.priceCoin} />
        <Text style={styles.priceText}>{price}</Text>
      </View>
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
    borderColor: '#DDE8DC',
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
