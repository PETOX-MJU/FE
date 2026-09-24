import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BoneButton } from '@/components/BoneButton';
import { OnboardingHeader } from '@/components/OnboardingHeader';
import {
  GOAL_PRESETS,
  formatMinutes,
  onboardingStrings as S,
} from '@/constants/onboardingStrings';
import { petoxColors, petoxLayout, petoxTextBase } from '@/theme/petox';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'OnboardingGoal'>;

const STEP_MIN = 30;
const MIN_GOAL = 30;
const MAX_GOAL = 12 * 60;

export function OnboardingGoalScreen({ navigation }: Props) {
  const [minutes, setMinutes] = useState(60);

  const bump = (delta: number) =>
    setMinutes(m => Math.min(MAX_GOAL, Math.max(MIN_GOAL, m + delta)));

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.body}>
        <OnboardingHeader step={1} total={5} onBack={() => navigation.goBack()} />

        <Text style={styles.title}>{S.goalTitle}</Text>
        <Text style={styles.subtitle}>{S.goalSubtitle}</Text>

        <View style={styles.stepper}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="줄이기"
            onPress={() => bump(-STEP_MIN)}
            style={({ pressed }) => [styles.round, pressed && styles.pressed]}>
            <Text style={styles.roundLabel}>−</Text>
          </Pressable>
          <Text style={styles.amount}>{formatMinutes(minutes)}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="늘리기"
            onPress={() => bump(STEP_MIN)}
            style={({ pressed }) => [styles.round, pressed && styles.pressed]}>
            <Text style={styles.roundLabel}>+</Text>
          </Pressable>
        </View>

        <View style={styles.chips}>
          {GOAL_PRESETS.map(p => {
            const on = p === minutes;
            return (
              <Pressable
                key={p}
                accessibilityRole="button"
                onPress={() => setMinutes(p)}
                style={[styles.chip, on && styles.chipOn]}>
                <Text style={[styles.chipLabel, on && styles.chipLabelOn]}>
                  {formatMinutes(p)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.hint}>{S.goalHint}</Text>

        <View style={styles.spacer} />

        <BoneButton
          text={S.next}
          onPress={() =>
            navigation.navigate('OnboardingBlockTime', { goalMinutes: minutes })
          }
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: petoxColors.white },
  body: {
    flex: 1,
    paddingHorizontal: petoxLayout.screenPadding,
    paddingBottom: 32,
  },
  title: {
    ...petoxTextBase,
    marginTop: 44,
    fontSize: 21,
    lineHeight: 30,
    color: petoxColors.text,
  },
  subtitle: {
    ...petoxTextBase,
    marginTop: 10,
    fontSize: 13,
    color: petoxColors.hint,
  },
  stepper: {
    marginTop: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  round: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: petoxColors.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.8 },
  roundLabel: {
    color: petoxColors.white,
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '700',
  },
  amount: {
    ...petoxTextBase,
    fontSize: 22,
    fontWeight: '700',
    color: petoxColors.text,
  },
  chips: {
    marginTop: 36,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  // 높이를 고정하고 가운데 정렬해, 선택 여부에 따라 글자가 위아래로 흔들리지 않게 합니다.
  chip: {
    height: 30,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: petoxColors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipOn: { borderColor: petoxColors.black },
  chipLabel: { ...petoxTextBase, fontSize: 13, color: petoxColors.hint },
  // 브랜드 폰트는 Regular 한 종류뿐이라 fontWeight 를 주면 기본 폰트로 떨어지고,
  // 그러면 선택된 칩만 글자 높이가 달라집니다. 색으로만 구분합니다.
  chipLabelOn: { color: petoxColors.text },
  hint: {
    ...petoxTextBase,
    marginTop: 26,
    textAlign: 'center',
    fontSize: 13,
    color: '#B9C7B8',
  },
  spacer: { flex: 1, minHeight: 40 },
});
