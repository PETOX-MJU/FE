import React, { useEffect, useState } from 'react';
import {
  Image,
  ImageBackground,
  Linking,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { showDialog } from '@/components/AppDialog';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { HOME_BG_ASPECT, homeImages } from '@/assets/images';
import { deleteAccount, hasSession, signOut } from '@/api/auth';
import {
  fetchNickname,
  fetchNotificationSettings,
  saveNotificationSettings,
  updateNickname,
  type NotificationSettings,
} from '@/api/profile';
import { ConfirmModal } from '@/components/ConfirmModal';
import { EditTextModal } from '@/components/EditTextModal';
import { renameServerPet } from '@/api/onboarding';
import {
  SCREEN_HEADER_HEIGHT,
  SCREEN_HEADER_TOP,
  ScreenHeader,
} from '@/components/ScreenHeader';
import { PetSprite } from '@/components/PetSprite';
import { screentime } from '@/features/screentime/onDevice';
import { useHomeScene } from '@/hooks/useHomeScene';
import type { PetId } from '@/constants/onboardingStrings';
import { loadPetProfile, savePetProfile } from '@/storage/petProfile';
import { petoxColors, petoxLayout, petoxTextBase } from '@/theme/petox';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'MyPage'>;

// 피그마 ViBE_CODING > Frame 5(마이페이지, 412 × 1023) 기준값.
// 상태바(0~37) 아래부터의 거리로 적는다.
const PET_TOP = 235 - 37; // 펫 그림(도트 부분) top
const PET_H = 137; // 펫 그림 높이 — 허스키_앞 기준
const PLATE_GAP = 386 - (235 + 137); // 펫 발끝 ~ 이름판 top
const PLATE_W = 199;
const PLATE_H = 66;
const FADE_H = 597; // 흰 그라데이션(Rectangle 1540) 높이
const LIST_TOP_GAP = 473 - 452; // 이름판 아래 ~ 첫 섹션 제목 (시안 21dp)
const DESIGN_H = 1023 - 37; // 프레임 높이(상태바 제외) — 화면이 더 짧으면 스크롤

// 설정 목록 — 모든 줄을 같은 왼쪽 선(화면 여백 24, 헤더와 동일)에 맞춘다.
type MenuRow =
  | {
      kind: 'links';
      items: { label: string; color?: string; onPress: () => void }[];
    }
  | {
      kind: 'toggle';
      label: string;
      value: boolean;
      onChange: (v: boolean) => void;
    };
type MenuSection = { title: string; rows: MenuRow[] };

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

  const [logoutOpen, setLogoutOpen] = useState(false);
  const onLogout = () => setLogoutOpen(true);
  // 회원탈퇴 — 되돌릴 수 없어서 두 번 확인한다.
  const [deleteStep, setDeleteStep] = useState<0 | 1 | 2>(0);
  const onDeleteAccount = () =>
    signedIn ? setDeleteStep(1) : showDialog({ title: '로그인이 필요해요' });
  const doDeleteAccount = async () => {
    try {
      await deleteAccount();
      setDeleteStep(0);
      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
      showDialog({
        title: '탈퇴했어요',
        message: '그동안 펫톡스와 함께해 줘서 고마워요.',
      });
    } catch {
      setDeleteStep(0);
      showDialog({
        title: '탈퇴하지 못했어요',
        message: '잠시 후 다시 시도해 주세요.',
      });
    }
  };

  const doLogout = async () => {
    try {
      await signOut();
    } catch {
      // 네트워크가 끊겨도 기기의 세션은 지워지므로 로그인 화면으로 보낸다.
    }
    setLogoutOpen(false);
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  // 개인 프로필·알림 설정 (서버).
  // 로그인 여부는 세션으로 판단한다. 닉네임이 비어 있거나(가입 때 저장 실패 등)
  // 불러오기에 실패해도 로그인 상태면 바꿀 수 있어야 한다.
  const [signedIn, setSignedIn] = useState(false);
  const [nickname, setNickname] = useState('');
  const [notif, setNotif] = useState<NotificationSettings>({
    missionAlert: true,
    reportAlert: true,
  });
  const [editing, setEditing] = useState<'petName' | 'nickname' | null>(null);

  useEffect(() => {
    hasSession()
      .then(ok => {
        setSignedIn(ok);
        if (!ok) return;
        fetchNickname()
          .then(n => setNickname(n ?? ''))
          .catch(e => console.warn('닉네임을 불러오지 못했어요', e));
        fetchNotificationSettings()
          .then(n => n && setNotif(n))
          .catch(e => console.warn('알림 설정을 불러오지 못했어요', e));
      })
      .catch(() => setSignedIn(false));
  }, []);

  const savePetName = async (name: string) => {
    const profile = await loadPetProfile();
    if (!profile) throw new Error('no pet profile');
    await savePetProfile({ ...profile, name });
    await renameServerPet(name);
    setPetName(name);
    setEditing(null);
  };

  const saveNickname = async (name: string) => {
    await updateNickname(name);
    setNickname(name);
    setEditing(null);
  };

  const toggleNotif = (key: keyof NotificationSettings) => (v: boolean) => {
    if (!signedIn) {
      showDialog({
        title: '로그인이 필요해요',
        message: '로그인하면 알림을 설정할 수 있어요.',
      });
      return;
    }
    const next = { ...notif, [key]: v };
    setNotif(next); // 먼저 반영하고, 실패하면 되돌린다
    saveNotificationSettings(next).catch(() => {
      setNotif(notif);
      showDialog({
        title: '저장 실패',
        message: '잠시 후 다시 시도해 주세요.',
      });
    });
  };

  // 사용자 관리 3개는 로그인해야 서버에 저장할 수 있다. 회원탈퇴는 BE Edge Function(delete-account) 연동 시 확인 절차와 함께 붙인다.
  const needLogin =
    (route: 'DetectedApps' | 'GoalSettings' | 'BlockTimeSettings') => () =>
      signedIn
        ? navigation.navigate(route)
        : showDialog({
            title: '로그인이 필요해요',
            message: '로그인하면 설정을 바꿀 수 있어요.',
          });

  const sections: MenuSection[] = [
    {
      title: '펫 프로필',
      rows: [
        {
          kind: 'links',
          items: [
            {
              label: '이름 변경',
              onPress: () =>
                petName
                  ? setEditing('petName')
                  : showDialog({
                      title: '이름 변경',
                      message: '온보딩에서 펫을 먼저 등록해 주세요.',
                    }),
            },
          ],
        },
      ],
    },
    {
      title: '개인 프로필',
      rows: [
        {
          kind: 'links',
          items: [
            {
              label: '닉네임 변경',
              onPress: () =>
                signedIn
                  ? setEditing('nickname')
                  : showDialog({
                      title: '로그인이 필요해요',
                      message: '로그인하면 닉네임을 바꿀 수 있어요.',
                    }),
            },
          ],
        },
      ],
    },
    {
      title: '사용자 관리',
      rows: [
        {
          kind: 'links',
          items: [
            { label: '감지 앱 관리', onPress: needLogin('DetectedApps') },
            { label: '목표 관리', onPress: needLogin('GoalSettings') },
            { label: '시간대 설정', onPress: needLogin('BlockTimeSettings') },
          ],
        },
      ],
    },
    {
      title: '알림 설정',
      rows: [
        {
          kind: 'toggle',
          label: '미션 알림',
          value: notif?.missionAlert ?? true,
          onChange: toggleNotif('missionAlert'),
        },
        {
          kind: 'toggle',
          label: '주간 리포트 알림',
          value: notif?.reportAlert ?? true,
          onChange: toggleNotif('reportAlert'),
        },
      ],
    },
    {
      title: '권한 관리',
      rows: [
        {
          kind: 'links',
          items: [
            {
              label: '사용 정보 접근',
              onPress: () =>
                screentime.available
                  ? screentime.openUsageAccessSettings()
                  : Linking.openSettings(),
            },
            {
              label: '다른 앱 위에 표시',
              onPress: () =>
                Linking.sendIntent(
                  'android.settings.action.MANAGE_OVERLAY_PERMISSION',
                ).catch(() => Linking.openSettings()),
            },
          ],
        },
      ],
    },
    {
      title: '계정 정보 관리',
      rows: [
        {
          kind: 'links',
          items: [
            { label: '로그아웃', color: '#577CE4', onPress: onLogout },
            { label: '회원탈퇴', color: '#E45759', onPress: onDeleteAccount },
          ],
        },
      ],
    },
  ];

  // 홈과 같은 배경(적용 중인 테마의 산 단계 그림, 없으면 기본 초원)을
  // 화면 높이에 맞춰 덮는다(cover, 위쪽 기준).
  const scene = useHomeScene();
  const pageH = Math.max(screenH, insets.top + DESIGN_H);
  const bgW = Math.max(screenW, pageH * HOME_BG_ASPECT);
  const bgH = bgW / HOME_BG_ASPECT;
  const fadeTop = insets.top + 428 - 37;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        bounces={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ minHeight: pageH }}
      >
        <Image
          source={scene ?? homeImages.background}
          resizeMode="cover"
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
          style={[styles.fade, { top: fadeTop }]}
        />
        {/* 그라데이션 아래는 끝까지 흰색 (목록이 길어져도 배경이 비치지 않게) */}
        <View style={[styles.fadeRest, { top: fadeTop + FADE_H }]} />

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
            resizeMode="contain"
          >
            <Text style={styles.petName} numberOfLines={1}>
              {petName || '내 펫'}
            </Text>
          </ImageBackground>
        </View>

        {/* 설정 목록 */}
        <View style={[styles.list, { paddingBottom: insets.bottom + 40 }]}>
          {sections.map(sec => (
            <View key={sec.title} style={styles.section}>
              <Text style={styles.sectionTitle}>{sec.title}</Text>
              <View style={styles.divider} />
              {sec.rows.map((row, i) =>
                row.kind === 'links' ? (
                  <View key={i} style={styles.linkRow}>
                    {row.items.map(item => (
                      <Pressable
                        key={item.label}
                        accessibilityRole="button"
                        onPress={item.onPress}
                        hitSlop={10}
                      >
                        <Text
                          style={[
                            styles.item,
                            item.color ? { color: item.color } : null,
                          ]}
                        >
                          {item.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : (
                  <View key={i} style={styles.toggleRow}>
                    <Text style={styles.item}>{row.label}</Text>
                    <Switch
                      value={row.value}
                      onValueChange={row.onChange}
                      trackColor={{ false: '#D9D9D9', true: petoxColors.green }}
                      thumbColor={petoxColors.white}
                    />
                  </View>
                ),
              )}
            </View>
          ))}
        </View>
      </ScrollView>

      <EditTextModal
        visible={editing === 'petName'}
        title="펫 이름 변경"
        initialValue={petName}
        placeholder="새 이름"
        maxLength={10}
        onCancel={() => setEditing(null)}
        onSave={savePetName}
      />
      <EditTextModal
        visible={editing === 'nickname'}
        title="닉네임 변경"
        initialValue={nickname}
        placeholder="새 닉네임"
        maxLength={12}
        onCancel={() => setEditing(null)}
        onSave={saveNickname}
      />
      <ConfirmModal
        visible={logoutOpen}
        title="로그아웃"
        message="로그아웃할까요?"
        confirmText="로그아웃"
        confirmColor="#577CE4"
        onCancel={() => setLogoutOpen(false)}
        onConfirm={doLogout}
      />
      <ConfirmModal
        visible={deleteStep === 1}
        title="회원탈퇴"
        message="탈퇴하면 펫, 코인, 산 아이템, 기록이 모두 사라지고 되돌릴 수 없어요. 계속할까요?"
        confirmText="계속"
        confirmColor="#E45759"
        onCancel={() => setDeleteStep(0)}
        onConfirm={() => setDeleteStep(2)}
      />
      <ConfirmModal
        visible={deleteStep === 2}
        title="정말 탈퇴할까요?"
        message="마지막 확인이에요. 탈퇴하기를 누르면 바로 지워져요."
        confirmText="탈퇴하기"
        confirmColor="#E45759"
        onCancel={() => setDeleteStep(0)}
        onConfirm={doDeleteAccount}
      />
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
  fade: { position: 'absolute', left: 0, right: 0, height: FADE_H },
  fadeRest: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
  },
  list: {
    marginTop: LIST_TOP_GAP,
    paddingHorizontal: petoxLayout.screenPadding,
  },
  section: { marginBottom: 22 },
  sectionTitle: { ...petoxTextBase, fontSize: 18, color: '#000000' },
  divider: { height: 1, marginTop: 6, backgroundColor: '#E6E6E6' },
  linkRow: { flexDirection: 'row', gap: 24, marginTop: 12 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  item: { ...petoxTextBase, fontSize: 15, color: '#6C6C6C' },
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
