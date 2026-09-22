import React, { useMemo, useState } from "react";
import {
  Image,
  StatusBar,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  HOME_BG_ASPECT,
  homeImages,
  petImages,
  type PetId,
} from "@/assets/images";
import { CoinBadge } from "@/components/CoinBadge";
import { GlassButton } from "@/components/GlassButton";
import { BackdropContext, type Backdrop } from "@/components/GlassSurface";
import { HomeTopActions } from "@/components/HomeTopActions";
import { PetCharacter } from "@/components/PetCharacter";
import { useDailyPetReward } from "@/hooks/useDailyPetReward";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/RootNavigator";

const PET_REWARD = 5;

// 피그마 home_screen 기준값 (412 × 917 프레임)
const DESIGN_H = 917;
const PET_X = 224.4; // 펫 스프라이트 왼쪽 위 — 배경 위 좌표
const PET_Y = 546.5;
const TOP_BAR_BELOW_STATUS = 36; // 상태바(32) 아래 36 → y 68
const BOTTOM_BAR_BOTTOM = 50; // 홈 버튼 아래 여백 (917 - 839)

// TODO: 온보딩에서 고른 캐릭터를 저장소(AsyncStorage/Supabase)에서 읽어와 넣기
const DEFAULT_PET: PetId = "rottweiler";

// TODO: 코인은 지금 화면 로컬 상태다. coin_ledger(Supabase)가 붙으면
// 초기값을 서버에서 읽어오고 claim 시 원장에 기록하도록 바꿔야 한다.
type Props = NativeStackScreenProps<RootStackParamList, "Home">;

export function HomeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const [coins, setCoins] = useState(270);
  const { canClaim, claim } = useDailyPetReward();

  // 배경: 피그마처럼 화면 높이에 맞추고 왼쪽 정렬(오른쪽이 잘림).
  // 화면이 배경보다 가로로 넓으면 가로에 맞춘다.
  const bgW = Math.max(screenW, screenH * HOME_BG_ASPECT);
  const bgH = bgW / HOME_BG_ASPECT;
  const k = bgH / DESIGN_H; // 피그마 배경 좌표 → 화면 좌표 배율

  const backdrop = useMemo<Backdrop>(
    () => ({ source: homeImages.background, width: bgW, height: bgH }),
    [bgW, bgH],
  );

  const handlePetTap = () => {
    if (claim()) {
      setCoins((prev) => prev + PET_REWARD);
    }
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
          source={petImages[DEFAULT_PET]}
          scale={k}
          canClaim={canClaim}
          rewardAmount={PET_REWARD}
          onTap={handlePetTap}
          style={[styles.pet, { left: PET_X * k, top: PET_Y * k }]}
        />

        <View
          style={[styles.topBar, { top: insets.top + TOP_BAR_BELOW_STATUS }]}
        >
          <CoinBadge amount={coins} />
          <HomeTopActions />
        </View>

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
            onPress={() => navigation.navigate("ScreentimeDashboard")}
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
          />
        </View>
      </BackdropContext.Provider>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#7EC4EE",
    overflow: "hidden",
  },
  background: {
    position: "absolute",
    left: 0,
    top: 0,
  },
  pet: {
    position: "absolute",
  },
  topBar: {
    position: "absolute",
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  bottomBar: {
    position: "absolute",
    left: 43,
    right: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
});
