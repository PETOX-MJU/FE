import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BoneProgress } from '@/components/BoneProgress';
import { OnboardingHeader } from '@/components/OnboardingHeader';
import { WalkingDog } from '@/components/WalkingDog';
import { onboardingStrings as S } from '@/constants/onboardingStrings';
import { petoxColors, petoxLayout, petoxTextBase } from '@/theme/petox';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'OnboardingConvert'>;

// 실제 변환 로직이 붙기 전까지 쓰는 임시 진행 속도.
const TICK_MS = 60;

export function OnboardingConvertScreen({ navigation, route }: Props) {
  const { goalMinutes, blockSlots } = route.params;
  const [percent, setPercent] = useState(0);
  const done = useRef(false);

  useEffect(() => {
    // TODO: 사진 -> 픽셀 캐릭터 변환 연결. 지금은 진행률만 흉내 냅니다.
    const timer = setInterval(() => {
      setPercent(p => {
        if (p >= 100) return 100;
        return p + 1;
      });
    }, TICK_MS);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (percent < 100 || done.current) return;
    done.current = true;
    // 완성된 캐릭터를 들고 확정 화면으로. 뒤로 눌러 변환 화면에 돌아오지 않도록 replace.
    // TODO: 변환 결과 이미지 경로를 generatedUri 로 넘기면 확정 화면에 표시됩니다.
    navigation.replace('OnboardingConfirm', { goalMinutes, blockSlots });
  }, [percent, navigation, goalMinutes, blockSlots]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.body}>
        <OnboardingHeader step={3} total={4} onBack={() => navigation.goBack()} />

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
