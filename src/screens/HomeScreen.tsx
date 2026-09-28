import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AppState,
  Image,
  type ImageSourcePropType,
  Pressable,
  StatusBar,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { loadPetProfile } from '@/storage/petProfile';
import { requestUsageSync } from '@/features/screentime/sync';
import {
  nextMissingPermission,
  openOverlaySettings,
  openUsageSettings,
  overlayPermissionText,
  requestNotificationPermission,
  syncOverlay,
} from '@/features/overlay/overlay';
import { ConfirmModal } from '@/components/ConfirmModal';
import {
  HOME_BG_ASPECT,
  homeImages,
  homePetImages,
  petImages,
  type PetId,
} from '@/assets/images';
import { CoinBadge } from '@/components/CoinBadge';
import { GlassButton } from '@/components/GlassButton';
import { BackdropContext, type Backdrop } from '@/components/GlassSurface';
import { HomeTopActions } from '@/components/HomeTopActions';
import { PET_SPRITE_W, PetCharacter } from '@/components/PetCharacter';
import { PetSlotPanel } from '@/components/PetSlotPanel';
import { petWalk as petWalks, type PetWalk } from '@/assets/images/petWalk';
import { ShopPanel } from '@/components/ShopPanel';
import { useCoinBalance } from '@/hooks/useCoinBalance';
import { useDailyCheckIn } from '@/hooks/useDailyCheckIn';
import { useHomeScene } from '@/hooks/useHomeScene';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/RootNavigator';

const PET_REWARD = 5;

// 피그마 home_screen 기준값 (412 × 917 프레임)
const DESIGN_H = 917;
const PET_X = 224.4; // 펫 스프라이트 왼쪽 위 — 배경 위 좌표
const PET_Y = 546.5;
const TOP_BAR_BELOW_STATUS = 36; // 상태바(32) 아래 36 → y 68
const TOP_BAR_H = 50; // 상단 pill 높이
const BOTTOM_BAR_BOTTOM = 50; // 홈 버튼 아래 여백 (917 - 839)
const HOME_BTN_SIZE = 96; // 가운데 홈 버튼 지름 — 펫 슬롯 패널을 이 위에 띄운다

// 온보딩에서 아무것도 못 불러왔을 때 보여줄 펫
const DEFAULT_PET: PetId = 'rottweiler';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export function HomeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();
  // 코인은 서버 원장(coin_ledger) 합계. 로그인 전이거나 불러오기 전엔 0.
  const { coins } = useCoinBalance();
  // 홈 위에 겹쳐 뜨는 말풍선 패널은 한 번에 하나만 (상점 ↔ 펫 슬롯)
  const [openPanel, setOpenPanel] = useState<'shop' | 'pets' | null>(null);
  const togglePanel = (which: 'shop' | 'pets') =>
    setOpenPanel(cur => (cur === which ? null : which));
  const { canCheckIn, checkIn, devResetCheckIn } = useDailyCheckIn();

  // 온보딩에서 고른 내 펫. 사진으로 만든 캐릭터(generatedUri)가 있으면 그걸, 아니면 고른 기본 캐릭터.
  const [petSource, setPetSource] = useState<ImageSourcePropType>(
    petImages[DEFAULT_PET],
  );
  // 걷기 그림이 있는 기본 캐릭터면 홈에서 좌우로 돌아다닌다 (코기·사진 캐릭터는 제자리)
  const [petWalk, setPetWalk] = useState<PetWalk | undefined>();
  const [petName, setPetName] = useState<string | undefined>();
  // 사진으로 펫을 추가할 때 온보딩 화면에 그대로 넘겨 줄 값
  const [petGoal, setPetGoal] = useState<{
    goalMinutes: number;
    blockSlots: string[];
  } | null>(null);
  // ---- 펫 오버레이 (필수 기능) ----
  // 홈에 올 때마다, 설정에서 돌아올 때마다 권한을 확인하고
  // 빠진 권한이 있으면 안내 팝업, 다 있으면 서비스를 (다시) 시작한다.
  const [permAsk, setPermAsk] = useState<'overlay' | 'usage' | null>(null);
  const ensureOverlay = useCallback(async () => {
    const missing = await nextMissingPermission();
    setPermAsk(missing);
    if (!missing) {
      await syncOverlay();
      // 사용시간 업로드 — 동의를 아직 안 물었으면 한 번 묻고, 동의했으면 올린다(5분에 한 번).
      // 서버는 그날 사용시간이 한 줄도 없으면 미션을 실패로 정산한다.
      requestUsageSync();
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      requestNotificationPermission()
        .catch(() => false)
        .then(() => ensureOverlay())
        .catch(() => {});
    }, [ensureOverlay]),
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', st => {
      if (st === 'active') ensureOverlay().catch(() => {});
    });
    return () => sub.remove();
  }, [ensureOverlay]);

  useFocusEffect(
    useCallback(() => {
      loadPetProfile()
        .then(profile => {
          setPetName(profile?.name);
          setPetGoal(
            profile
              ? {
                  goalMinutes: profile.goalMinutes,
                  blockSlots: profile.blockSlots,
                }
              : null,
          );
          if (profile?.generatedUri) {
            setPetSource({ uri: profile.generatedUri });
            setPetWalk(undefined);
          } else if (profile?.pet) {
            setPetSource(homePetImages[profile.pet]);
            setPetWalk(petWalks[profile.pet]);
          }
        })
        .catch(() => {});
    }, []),
  );

  // 배경: 피그마처럼 화면 높이에 맞추고 왼쪽 정렬(오른쪽이 잘림).
  // 화면이 배경보다 가로로 넓으면 가로에 맞춘다.
  const bgW = Math.max(screenW, screenH * HOME_BG_ASPECT);
  const bgH = bgW / HOME_BG_ASPECT;
  const k = bgH / DESIGN_H; // 피그마 배경 좌표 → 화면 좌표 배율

  // 적용 중인 테마가 있으면 산 단계의 그림, 없으면 기본 초원
  const scene = useHomeScene();
  const bgSource = scene ?? homeImages.background;

  const backdrop = useMemo<Backdrop>(
    () => ({ source: bgSource, width: bgW, height: bgH }),
    [bgSource, bgW, bgH],
  );

  // 오늘 처음 쓰다듬으면 출석 + 코인 지급(서버 check_in, 코인 +5).
  const handlePetTap = () => {
    checkIn();
  };

  return (
    <View style={styles.root}>
      {/* RN 0.87 Android는 edge-to-edge라 배경이 상태바 뒤까지 깔린다 */}
      <StatusBar barStyle="dark-content" />
      <Image
        source={bgSource}
        resizeMode="cover"
        style={[styles.background, { width: bgW, height: bgH }]}
      />

      <BackdropContext.Provider value={backdrop}>
        <PetCharacter
          source={petSource}
          scale={k}
          canClaim={canCheckIn}
          rewardAmount={PET_REWARD}
          onTap={handlePetTap}
          // 개발 모드에서 펫을 길게 누르면 출석 전 상태로 (말풍선 확인용)
          onLongPress={__DEV__ ? devResetCheckIn : undefined}
          style={[styles.pet, { left: PET_X * k, top: PET_Y * k }]}
          walk={petWalk}
          // 화면 양끝에서 16dp 안쪽까지만 걸어간다
          roam={{
            min: 16 - PET_X * k,
            max: screenW - 16 - (PET_X + PET_SPRITE_W) * k,
          }}
        />

        {openPanel !== null && (
          <Pressable
            style={StyleSheet.absoluteFill}
            accessibilityLabel="닫기"
            onPress={() => setOpenPanel(null)}
          />
        )}

        <View
          style={[styles.topBar, { top: insets.top + TOP_BAR_BELOW_STATUS }]}
        >
          <CoinBadge amount={coins ?? 0} />
          <HomeTopActions
            shopOpen={openPanel === 'shop'}
            onPressShop={() => togglePanel('shop')}
          />
        </View>

        {openPanel === 'shop' && (
          <ShopPanel
            style={[
              styles.shopPanel,
              { top: insets.top + TOP_BAR_BELOW_STATUS + TOP_BAR_H + 8 },
            ]}
          />
        )}

        <View
          style={[
            styles.bottomBar,
            { bottom: insets.bottom + BOTTOM_BAR_BOTTOM },
          ]}
        >
          <GlassButton
            icon={homeImages.report}
            iconWidth={36}
            iconHeight={40}
            size={68}
            accessibilityLabel="리포트"
            onPress={() => navigation.navigate('ScreentimeDashboard')}
          />
          <GlassButton
            icon={homeImages.home}
            iconWidth={51}
            iconHeight={51}
            size={HOME_BTN_SIZE}
            accessibilityLabel={openPanel === 'pets' ? '펫 슬롯 닫기' : '펫 슬롯'}
            onPress={() => togglePanel('pets')}
          />
          <GlassButton
            icon={homeImages.character}
            iconWidth={39}
            iconHeight={40}
            size={68}
            accessibilityLabel="캐릭터"
            onPress={() => navigation.navigate('MyPage')}
          />
        </View>

        {openPanel === 'pets' && (
          <PetSlotPanel
            petSource={petSource}
            petName={petName}
            // 잠금을 풀면 회원가입 때와 같은 사진 등록 화면으로 보낸다
            onAddPet={() => {
              setOpenPanel(null);
              navigation.navigate('OnboardingPetPhoto', {
                goalMinutes: petGoal?.goalMinutes ?? 120,
                blockSlots: petGoal?.blockSlots ?? [],
              });
            }}
            style={[
              styles.petSlotPanel,
              {
                bottom: insets.bottom + BOTTOM_BAR_BOTTOM + HOME_BTN_SIZE + 8,
              },
            ]}
          />
        )}
      </BackdropContext.Provider>

      <ConfirmModal
        visible={permAsk !== null}
        title={permAsk ? overlayPermissionText[permAsk].title : ''}
        message={permAsk ? overlayPermissionText[permAsk].message : undefined}
        confirmText="설정 열기"
        cancelText="나중에"
        onCancel={() => setPermAsk(null)}
        onConfirm={() => {
          if (permAsk === 'overlay') openOverlaySettings();
          else openUsageSettings();
          setPermAsk(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#7EC4EE',
    overflow: 'hidden',
  },
  background: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  pet: {
    position: 'absolute',
  },
  topBar: {
    position: 'absolute',
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  shopPanel: {
    position: 'absolute',
    left: 18,
    right: 18,
  },
  // 홈 버튼 위로 펼쳐지는 펫 슬롯 패널 (꼬리가 홈 버튼을 가리킨다)
  petSlotPanel: {
    position: 'absolute',
    left: 60,
    right: 60,
  },
  bottomBar: {
    position: 'absolute',
    left: 43,
    right: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
