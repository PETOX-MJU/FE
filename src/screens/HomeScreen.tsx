import React, { useCallback, useMemo, useState } from 'react';
import {
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
import { PetCharacter } from '@/components/PetCharacter';
import { ShopPanel } from '@/components/ShopPanel';
import { useCoinBalance } from '@/hooks/useCoinBalance';
import { useDailyCheckIn } from '@/hooks/useDailyCheckIn';
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

// 온보딩에서 아무것도 못 불러왔을 때 보여줄 펫
const DEFAULT_PET: PetId = 'rottweiler';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export function HomeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();
  // 코인은 서버 원장(coin_ledger) 합계. 로그인 전이거나 불러오기 전엔 0.
  const { coins } = useCoinBalance();
  const [shopOpen, setShopOpen] = useState(false);
  const { canCheckIn, checkIn, devResetCheckIn } = useDailyCheckIn();

  // 온보딩에서 고른 내 펫. 사진으로 만든 캐릭터(generatedUri)가 있으면 그걸, 아니면 고른 기본 캐릭터.
  const [petSource, setPetSource] = useState<ImageSourcePropType>(
    petImages[DEFAULT_PET],
  );
  useFocusEffect(
    useCallback(() => {
      loadPetProfile()
        .then(profile => {
          if (profile?.generatedUri)
            setPetSource({ uri: profile.generatedUri });
          else if (profile?.pet) setPetSource(homePetImages[profile.pet]);
        })
        .catch(() => {});
    }, []),
  );

  // 배경: 피그마처럼 화면 높이에 맞추고 왼쪽 정렬(오른쪽이 잘림).
  // 화면이 배경보다 가로로 넓으면 가로에 맞춘다.
  const bgW = Math.max(screenW, screenH * HOME_BG_ASPECT);
  const bgH = bgW / HOME_BG_ASPECT;
  const k = bgH / DESIGN_H; // 피그마 배경 좌표 → 화면 좌표 배율

  const backdrop = useMemo<Backdrop>(
    () => ({ source: homeImages.background, width: bgW, height: bgH }),
    [bgW, bgH],
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
        source={homeImages.background}
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
        />

        {shopOpen && (
          <Pressable
            style={StyleSheet.absoluteFill}
            accessibilityLabel="상점 닫기"
            onPress={() => setShopOpen(false)}
          />
        )}

        <View
          style={[styles.topBar, { top: insets.top + TOP_BAR_BELOW_STATUS }]}
        >
          <CoinBadge amount={coins ?? 0} />
          <HomeTopActions
            shopOpen={shopOpen}
            onPressShop={() => setShopOpen(open => !open)}
          />
        </View>

        {shopOpen && (
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
            size={96}
            accessibilityLabel="홈"
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
      </BackdropContext.Provider>
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
  bottomBar: {
    position: 'absolute',
    left: 43,
    right: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
