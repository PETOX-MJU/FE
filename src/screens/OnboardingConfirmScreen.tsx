import React, { useRef, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { showDialog } from '@/components/AppDialog';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BoneButton } from '@/components/BoneButton';
import { OnboardingHeader } from '@/components/OnboardingHeader';
import { ScreenHeader } from '@/components/ScreenHeader';
import { PetoxTextField } from '@/components/PetoxTextField';
import { PetSprite } from '@/components/PetSprite';
import { onboardingStrings as S } from '@/constants/onboardingStrings';
import { NotEnoughCoinsError, buyItem, notifyShopChanged } from '@/api/shop';
import { notifyCoinsChanged } from '@/hooks/useCoinBalance';
import {
  PetSlotFullError,
  addServerPet,
  saveOnboardingToServer,
} from '@/api/onboarding';
import { addPet as addLocalPet, savePetProfile } from '@/storage/petProfile';
import { petoxColors, petoxLayout, petoxTextBase } from '@/theme/petox';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Props = NativeStackScreenProps<
  RootStackParamList,
  'OnboardingConfirm' | 'AddPetConfirm'
>;

const SPRITE = 220;

const SPOTLIGHT_W = 240;

export function OnboardingConfirmScreen({ navigation, route }: Props) {
  const { goalMinutes, blockSlots, pet, generatedUri } = route.params;
  // 홈 펫 슬롯에서 온 "펫 추가" — 기존 펫은 두고 한 마리 더 만든다
  const addPet = route.name === 'AddPetConfirm';
  const { slot } = route.params;
  const [name, setName] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const onSubmit = async () => {
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      setError(S.confirmErrorName);
      return;
    }
    if (saving) return;

    setSaving(true);
    if (addPet) {
      await saveNewPet(trimmed);
      return;
    }
    try {
      await savePetProfile({
        name: trimmed,
        pet,
        generatedUri,
        goalMinutes,
        blockSlots,
        createdAt: new Date().toISOString(),
      });
      // 서버에도 올린다 — 로그인할 때 온보딩 완료 여부를 계정 기준으로 판단하는 근거.
      await saveOnboardingToServer({
        petName: trimmed,
        goalMinutes,
        isDefaultCharacter: pet !== undefined,
        breed: pet,
      });
      navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
    } catch {
      setSaving(false);
      showDialog({ title: '저장 실패', message: S.confirmErrorSave });
    }
  };

  /**
   * 펫 슬롯에서 온 경우 — 기존 펫은 그대로 두고 한 마리 더 만든다.
   * 서버에 먼저 만들고(슬롯 한도는 서버가 판단) 성공하면 기기 목록에 더해 홈에 내보낸다.
   */
  // 슬롯은 한 번만 산다 — 산 뒤 펫 만들기가 실패해서 다시 눌러도 또 사지 않게
  const slotBought = useRef(false);
  const saveNewPet = async (trimmed: string) => {
    // 잠긴 칸에서 왔으면 여기서 슬롯을 산다 (코인은 이때 빠짐).
    // 사고 나서 펫 만들기가 실패해도 산 슬롯은 열린 빈 칸으로 남아 다시 등록할 수 있다.
    if (slot && !slotBought.current) {
      try {
        await buyItem(slot.itemId);
        slotBought.current = true;
      } catch (e) {
        setSaving(false);
        showDialog(
          e instanceof NotEnoughCoinsError
            ? {
                title: '코인이 부족해요',
                message: `새 친구를 데려오려면 ${slot.price}코인이 필요해요.`,
              }
            : { title: '저장 실패', message: S.confirmErrorSave },
        );
        return;
      } finally {
        notifyCoinsChanged();
        notifyShopChanged();
      }
    }
    try {
      const serverId = await addServerPet({
        name: trimmed,
        isDefaultCharacter: pet !== undefined,
        breed: pet,
      });
      await addLocalPet({ name: trimmed, pet, generatedUri, serverId });
      navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
    } catch (e) {
      setSaving(false);
      if (e instanceof PetSlotFullError) {
        showDialog({
          title: '빈 슬롯이 없어요',
          message: '홈의 펫 슬롯에서 잠금을 먼저 풀어 주세요.',
        });
      } else {
        showDialog({ title: '저장 실패', message: S.confirmErrorSave });
      }
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {addPet ? (
            <ScreenHeader
              title={S.addPetHeader}
              onBack={() => navigation.goBack()}
              style={styles.addHeader}
            />
          ) : (
            <OnboardingHeader
              step={5}
              total={5}
              onBack={() => navigation.goBack()}
            />
          )}

          <Text style={styles.title}>
            {addPet ? S.addPetConfirmTitle : S.confirmTitle}
          </Text>

          <View style={styles.stage}>
            <Image
              source={require('../assets/images/spotlight.png')}
              style={styles.spotlight}
              resizeMode="contain"
            />
            {/* 사진 변환 결과가 있으면 그것을, 기본 캐릭터를 골랐으면 그 캐릭터를. */}
            {generatedUri !== undefined ? (
              <Image
                source={{ uri: generatedUri }}
                style={styles.generated}
                resizeMode="contain"
              />
            ) : pet !== undefined ? (
              <PetSprite pet={pet} size={SPRITE} />
            ) : null}
          </View>

          <PetoxTextField
            value={name}
            onChangeText={next => {
              setName(next);
              setError(null);
            }}
            hint={S.confirmNameHint}
            style={styles.field}
          />

          {error !== null && <Text style={styles.error}>{error}</Text>}

          <View style={styles.spacer} />

          <BoneButton
            text={
              !addPet
                ? S.confirmSubmit
                : slot
                ? `${S.addPetConfirmSubmit} (${slot.price}코인)`
                : S.addPetConfirmSubmit
            }
            onPress={onSubmit}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // 펫 추가 화면 — 부모가 이미 좌우 여백을 준다
  addHeader: { paddingHorizontal: 0 },
  safe: { flex: 1, backgroundColor: petoxColors.white },
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: petoxLayout.screenPadding,
    paddingBottom: 32,
  },
  title: {
    ...petoxTextBase,
    marginTop: 44,
    fontSize: 21,
    color: petoxColors.text,
  },
  stage: {
    marginTop: 40,
    height: 240,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  // 조명 원본(design/조명.png)은 3:2 비율.
  spotlight: {
    position: 'absolute',
    top: 0,
    alignSelf: 'center',
    width: SPOTLIGHT_W,
    height: SPOTLIGHT_W / 1.5,
  },
  generated: { width: SPRITE, height: SPRITE },
  error: {
    ...petoxTextBase,
    alignSelf: 'flex-start',
    marginTop: 12,
    color: petoxColors.greenDark,
    fontSize: 13,
  },
  field: { marginTop: 36 },
  spacer: { flex: 1, minHeight: 40 },
});
