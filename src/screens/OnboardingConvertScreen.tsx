import React, { useEffect, useRef, useState } from 'react';
import { makePetFromPhoto } from '@/features/pet/recolor';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BoneProgress } from '@/components/BoneProgress';
import { OnboardingHeader } from '@/components/OnboardingHeader';
import { ScreenHeader } from '@/components/ScreenHeader';
import { WalkingDog } from '@/components/WalkingDog';
import { onboardingStrings as S } from '@/constants/onboardingStrings';
import { petoxColors, petoxLayout, petoxTextBase } from '@/theme/petox';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Props = NativeStackScreenProps<
  RootStackParamList,
  'OnboardingConvert' | 'AddPetConvert'
>;

// 실제 변환 로직이 붙기 전까지 쓰는 임시 진행 속도.
const TICK_MS = 60;

export function OnboardingConvertScreen({ navigation, route }: Props) {
  const { goalMinutes, blockSlots } = route.params;
  const addPet = route.name === 'AddPetConvert';
  const { slot, pet, photoUri } = route.params;
  const breed = pet ?? 'golden';
  const [percent, setPercent] = useState(0);
  const done = useRef(false);
  // 변환 결과 (undefined = 아직, null = 실패 → 견종 원본색으로 진행)
  const [made, setMade] = useState<string | null | undefined>(undefined);

  // 사진 털색 → 고른 견종 픽셀 템플릿 재색칠 (기기 안에서, AI pet_template 이식)
  useEffect(() => {
    let alive = true;
    makePetFromPhoto(photoUri, breed)
      .then(r => alive && setMade(r?.uri ?? null))
      .catch(() => alive && setMade(null));
    return () => {
      alive = false;
    };
  }, [photoUri, breed]);

  // 진행률 연출 — 변환은 금방 끝나지만 한 번에 튀지 않게 끝까지 채운다.
  // 결과가 아직이면 99 에서 기다린다.
  useEffect(() => {
    const timer = setInterval(() => {
      setPercent(p => {
        if (p >= 100) return 100;
        if (p >= 99 && made === undefined) return 99;
        return p + 1;
      });
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [made]);

  useEffect(() => {
    if (percent < 100 || made === undefined || done.current) return;
    done.current = true;
    // 완성된 캐릭터를 들고 확정 화면으로. 뒤로 눌러 변환 화면에 돌아오지 않도록 replace.
    navigation.replace(addPet ? 'AddPetConfirm' : 'OnboardingConfirm', {
      goalMinutes,
      blockSlots,
      slot,
      pet: breed,
      generatedUri: made ?? undefined,
    });
  }, [percent, made, navigation, goalMinutes, blockSlots, addPet, slot, breed]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.body}>
        {addPet ? (
          <ScreenHeader
            title={S.addPetHeader}
            onBack={() => navigation.goBack()}
            style={styles.addHeader}
          />
        ) : (
          <OnboardingHeader
            step={4}
            total={5}
            onBack={() => navigation.goBack()}
          />
        )}

        <Text style={styles.title}>{S.convertTitle}</Text>

        <View style={styles.dropzone}>
          {/* 변환되는 동안 걷는 강아지 */}
          <View style={styles.stage}>
            <WalkingDog size={64} />
          </View>

          <View style={styles.gauge}>
            <BoneProgress percent={percent} />
          </View>
          <Text style={styles.count}>{`${percent}개의 뼈다귀 수집중`}</Text>
        </View>

        <Text style={styles.guideTitle}>{S.convertGuideTitle}</Text>
        <Text style={styles.guideLine}>{S.convertGuide1}</Text>

        <View style={styles.spacer} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // 펫 추가 화면 — 부모가 이미 좌우 여백을 준다
  addHeader: { paddingHorizontal: 0 },
  safe: { flex: 1, backgroundColor: petoxColors.white },
  body: {
    flex: 1,
    paddingHorizontal: petoxLayout.screenPadding,
    paddingBottom: 54,
  },
  title: {
    ...petoxTextBase,
    marginTop: 37,
    fontSize: 21,
    lineHeight: 30,
    color: petoxColors.text,
  },
  dropzone: {
    marginTop: 102,
    padding: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: petoxColors.line,
    borderRadius: 14,
  },
  stage: {
    height: 179,
    borderRadius: 10,
    backgroundColor: '#E2E2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gauge: { marginTop: 25 },
  count: {
    ...petoxTextBase,
    marginTop: 10,
    textAlign: 'center',
    fontSize: 12,
    // 시안 샘플링 색(#7A7A7A) — 안내문(#9A9A9A)보다 살짝 진합니다.
    color: '#7A7A7A',
  },
  guideTitle: {
    ...petoxTextBase,
    marginTop: 29,
    fontSize: 12,
    color: petoxColors.hint,
  },
  guideLine: {
    ...petoxTextBase,
    marginTop: 6,
    fontSize: 11,
    lineHeight: 16,
    color: petoxColors.hint,
  },
  spacer: { flex: 1 },
});
