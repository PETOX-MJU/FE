import React, { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  ImageBackground,
  Linking,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { HOME_BG_ASPECT, homeImages } from '@/assets/images';
import { signOut } from '@/api/auth';
import {
  SCREEN_HEADER_HEIGHT,
  SCREEN_HEADER_TOP,
  ScreenHeader,
} from '@/components/ScreenHeader';
import { PetSprite } from '@/components/PetSprite';
import { screentime } from '@/features/screentime/onDevice';
import type { PetId } from '@/constants/onboardingStrings';
import { loadPetProfile } from '@/storage/petProfile';
import { petoxTextBase } from '@/theme/petox';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'MyPage'>;

// 피그마 ViBE_CODING > Frame 5(마이페이지, 412 × 1023) 기준값.
// 상태바(0~37) 아래부터의 거리로 적는다.
const PET_TOP = 235 - 37; // 펫 그림(도트 부분) top
const PET_H = 137; // 펫 그림 높이 — 허스키_앞 기준
const PLATE_GAP = 386 - (235 + 137); // 펫 발끝 ~ 이름판 top
const PLATE_W = 199;
const PLATE_H = 66;
const PLATE_BOTTOM = 386 + 66 - 37; // 이름판 아래 = 설정 목록 기준선
const DESIGN_H = 1023 - 37; // 프레임 높이(상태바 제외) — 화면이 더 짧으면 스크롤

// 설정 목록(Group 106). y 는 모두 "글자 아랫선" 기준 피그마 프레임 좌표.
// 제목은 18, 항목은 15 크기이고, 줄마다 들여쓰기가 시안에서 조금씩 다르다.
const TITLE_LH = 22;
const ITEM_LH = 18;
const LIST_LEFT = 37; // 구분선 x
const LIST_W = 342;

type MenuItem = { label: string; left: number; color?: string; onPress: () => void };
type MenuSection = {
  title: string;
  titleLeft: number;
  titleBottom: number;
  divider?: number; // 구분선 y (없으면 숨김)
  itemsBottom?: number;
  items: MenuItem[];
};

const soon = (label: string) => () => Alert.alert(label, '준비 중이에요.');

// 펫 스프라이트 PNG(544×544)는 도트 아래에 투명 여백 160px 이 있고, 허스키 도트 높이는 296px.
// 피그마처럼 도트가 137dp 가 되도록 전체를 키우고, 발끝(여백 위)을 기준선에 맞춘다.
const SPRITE_PX = 544;
const SPRITE_BOTTOM_PAD_PX = 160;
const HUSKY_DOT_H_PX = 296;
const SPRITE_SIZE = (PET_H / HUSKY_DOT_H_PX) * SPRITE_PX; // ≈ 252dp
const SPRITE_BOTTOM_PAD = (SPRITE_BOTTOM_PAD_PX / SPRITE_PX) * SPRITE_SIZE;

/** 온보딩 전이거나 저장된 펫이 없을 때 — 피그마 시안과 같은 허스키. */
const FALLBACK_PET: PetId = 'husky';

export function MyPageScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const [pet, setPet] = useState<PetId>(FALLBACK_PET);
  const [petName, setPetName] = useState('');

  // 온보딩 확정 화면에서 저장한 내 펫(종류·이름)을 보여준다.
  // TODO: 서버 pets 가 붙으면 그쪽에서 읽기. 사진으로 만든 캐릭터(generatedUri)도 표시.
  useEffect(() => {
    loadPetProfile()
      .then(profile => {
        if (!profile) return;
        if (profile.pet) setPet(profile.pet);
        setPetName(profile.name);
      })
      .catch(() => {});
  }, []);

  const onLogout = () =>
    Alert.alert('로그아웃', '로그아웃할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '로그아웃',
        onPress: async () => {
          try {
            await signOut();
          } catch {
            // 네트워크가 끊겨도 기기의 세션은 지워지므로 로그인 화면으로 보낸다.
          }
          navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
        },
      },
    ]);

  // TODO: 각 항목의 상세 화면은 아직 없다 — 화면이 생기면 navigate 로 바꾼다.
  // 회원탈퇴는 BE Edge Function(delete-account) 연동 시 확인 절차와 함께 붙인다.
  const sections: MenuSection[] = [
    {
      title: '펫 프로필',
      titleLeft: 45,
      titleBottom: 525,
      itemsBottom: 551,
      items: [{ label: '이름 변경', left: 83, onPress: soon('이름 변경') }],
    },
    {
      title: '개인 프로필',
      titleLeft: 45,
      titleBottom: 602,
      divider: 604,
      itemsBottom: 636,
      items: [{ label: '닉네임 변경', left: 83, onPress: soon('닉네임 변경') }],
    },
    {
      title: '사용자 관리',
      titleLeft: 45,
      titleBottom: 677,
      divider: 680,
      itemsBottom: 709,
      items: [
        { label: '감지 앱 관리', left: 46, onPress: soon('감지 앱 관리') },
        { label: '목표 관리', left: 148, onPress: soon('목표 관리') },
        { label: '시간대 설정', left: 238, onPress: soon('시간대 설정') },
      ],
    },
    { title: '알림 설정', titleLeft: 44, titleBottom: 755, divider: 759, items: [] },
    {
      title: '권한 관리',
      titleLeft: 46,
      titleBottom: 834,
      divider: 839,
      itemsBottom: 868,
      items: [
        {
          label: '사용 정보 접근',
          left: 70,
          onPress: () =>
            screentime.available
              ? screentime.openUsageAccessSettings()
              : Linking.openSettings(),
        },
        {
          label: '다른 앱 위에 표시',
          left: 189,
          onPress: () =>
            Linking.sendIntent('android.settings.action.MANAGE_OVERLAY_PERMISSION').catch(
              () => Linking.openSettings(),
            ),
        },
      ],
    },
    {
      title: '계정 정보 관리',
      titleLeft: 45,
      titleBottom: 914,
      divider: 919,
      itemsBottom: 946,
      items: [
        { label: '로그아웃', left: 63, color: '#577CE4', onPress: onLogout },
        { label: '회원탈퇴', left: 139, color: '#E45759', onPress: soon('회원탈퇴') },
      ],
    },
  ];

  // 홈과 같은 초원 배경을 화면 높이에 맞춰 덮는다(cover, 위쪽 기준).
  const pageH = Math.max(screenH, insets.top + DESIGN_H);
  const bgW = Math.max(screenW, pageH * HOME_BG_ASPECT);
  const bgH = bgW / HOME_BG_ASPECT;
  const listTop = insets.top + PLATE_BOTTOM; // 설정 목록 좌표의 0점(피그마 y=452)
  const y = (designY: number) => designY - (PLATE_BOTTOM + 37);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        bounces={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ minHeight: pageH }}>
        <Image
          source={homeImages.background}
          style={[styles.background, { width: bgW, height: bgH }]}
        />
        {/* 목록 뒤를 흰색으로 덮는 그라데이션 (Rectangle 1540, y 428 ~ 1025) */}
        <LinearGradient
          pointerEvents="none"
          colors={[
            'rgba(255,255,255,0)',
            'rgba(255,255,255,0.5)',
            'rgba(255,255,255,0.749)',
            'rgba(255,255,255,1)',
          ]}
          locations={[0, 0.089277, 0.15224, 1]}
          style={[styles.fade, { top: insets.top + 428 - 37 }]}
        />

        <View style={{ paddingTop: insets.top }}>
          {/* 헤더: 뒤로가기 + 제목 */}
          <ScreenHeader title="마이페이지" onBack={() => navigation.goBack()} />

          {/* 펫 + 이름판 */}
          <View style={styles.petStage}>
            <PetSprite pet={pet} size={SPRITE_SIZE} style={styles.sprite} />
          </View>
          <ImageBackground
            source={require('../assets/images/mypage/name_plate.png')}
            style={styles.plate}
            resizeMode="contain">
            <Text style={styles.petName} numberOfLines={1}>
              {petName || '내 펫'}
            </Text>
          </ImageBackground>
        </View>

        {/* 설정 목록 — 시안 좌표를 그대로 옮긴 고정 배치 */}
        <View style={[styles.list, { top: listTop }]}>
          {sections.map(sec => (
            <React.Fragment key={sec.title}>
              <Text
                style={[
                  styles.sectionTitle,
                  { left: sec.titleLeft, top: y(sec.titleBottom) - TITLE_LH },
                ]}>
                {sec.title}
              </Text>
              {sec.divider !== undefined && (
                <View style={[styles.divider, { top: y(sec.divider) }]} />
              )}
              {sec.items.map(item => (
                <Pressable
                  key={item.label}
                  accessibilityRole="button"
                  onPress={item.onPress}
                  hitSlop={10}
                  style={[
                    styles.itemHit,
                    { left: item.left, top: y(sec.itemsBottom ?? 0) - ITEM_LH },
                  ]}>
                  <Text
                    style={[styles.item, item.color ? { color: item.color } : null]}>
                    {item.label}
                  </Text>
                </Pressable>
              ))}
            </React.Fragment>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#8FC3EC', overflow: 'hidden' },
  background: { position: 'absolute', top: 0, alignSelf: 'center' },
  petStage: {
    height: PET_H,
    // 헤더는 대시보드와 같은 공용 헤더. 펫 위치는 시안 그대로 유지한다.
    marginTop: PET_TOP - (SCREEN_HEADER_TOP + SCREEN_HEADER_HEIGHT),
    alignItems: 'center',
  },
  sprite: { position: 'absolute', bottom: -SPRITE_BOTTOM_PAD },
  fade: { position: 'absolute', left: 1, width: 411, height: 597 },
  list: { position: 'absolute', left: 0, right: 0 },
  sectionTitle: {
    ...petoxTextBase,
    position: 'absolute',
    fontSize: 18,
    lineHeight: TITLE_LH,
    color: '#000000',
  },
  // 시안은 흰 1px 선이지만 흰 그라데이션 위에서 옅은 회색으로 보여 그 색을 쓴다.
  divider: {
    position: 'absolute',
    left: LIST_LEFT,
    width: LIST_W,
    height: 1,
    backgroundColor: '#E6E6E6',
  },
  itemHit: { position: 'absolute' },
  item: {
    ...petoxTextBase,
    fontSize: 15,
    lineHeight: ITEM_LH,
    color: '#6C6C6C',
  },
  plate: {
    width: PLATE_W,
    height: PLATE_H,
    marginTop: PLATE_GAP,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40, // 발바닥 무늬 안쪽에만 글자
  },
  petName: {
    ...petoxTextBase,
    fontSize: 20,
    color: '#000000',
    textAlign: 'center',
  },
});
