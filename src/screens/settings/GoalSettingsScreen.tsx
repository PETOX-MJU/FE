import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { showDialog } from '@/components/AppDialog';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BoneButton } from '@/components/BoneButton';
import { ScreenHeader } from '@/components/ScreenHeader';
import { fetchGoalMinutes, saveGoalMinutes } from '@/api/settings';
import { GOAL_PRESETS, formatMinutes } from '@/constants/onboardingStrings';
import { petoxColors, petoxLayout, petoxTextBase } from '@/theme/petox';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'GoalSettings'>;

// 온보딩 1단계(목표 설정)와 같은 조절 방식 — 30분 단위, 30분 ~ 12시간
const STEP_MIN = 30;
const MIN_GOAL = 30;
const MAX_GOAL = 12 * 60;

/** 마이페이지 > 목표 관리. 하루 숏폼 허용 시간을 바꾼다. */
export function GoalSettingsScreen({ navigation }: Props) {
  const [minutes, setMinutes] = useState<number | null>(null);
  const [saved, setSaved] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchGoalMinutes()
      .then(m => {
        setMinutes(m ?? 60);
        setSaved(m ?? 60);
      })
      .catch(() => setMinutes(60));
  }, []);

  const bump = (delta: number) =>
    setMinutes(m => Math.min(MAX_GOAL, Math.max(MIN_GOAL, (m ?? 60) + delta)));

  const save = async () => {
    if (minutes == null || saving) return;
    setSaving(true);
    try {
      await saveGoalMinutes(minutes);
      navigation.goBack();
    } catch {
      showDialog({
        title: '저장 실패',
        message: '잠시 후 다시 시도해 주세요.',
      });
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader title="목표 관리" onBack={() => navigation.goBack()} />
      <View style={styles.body}>
        <Text style={styles.title}>하루 숏폼 시청 목표</Text>
        <Text style={styles.subtitle}>
          하루 목표 시청 시간이에요. 대시보드에서 목표와 비교해 보여 드려요.
        </Text>

        <View style={styles.stepper}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="줄이기"
            onPress={() => bump(-STEP_MIN)}
            style={({ pressed }) => [styles.round, pressed && styles.pressed]}
          >
            <Text style={styles.roundLabel}>−</Text>
          </Pressable>
          <Text style={styles.amount}>
            {minutes == null ? '' : formatMinutes(minutes)}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="늘리기"
            onPress={() => bump(STEP_MIN)}
            style={({ pressed }) => [styles.round, pressed && styles.pressed]}
          >
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
                style={[styles.chip, on && styles.chipOn]}
              >
                <Text style={[styles.chipLabel, on && styles.chipLabelOn]}>
                  {formatMinutes(p)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {saved != null && (
          <Text style={styles.hint}>지금 목표: {formatMinutes(saved)}</Text>
        )}

        <View style={styles.spacer} />

        <BoneButton
          text="저장하기"
          disabled={minutes == null || minutes === saved || saving}
          onPress={save}
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
    marginTop: 32,
    fontSize: 21,
    color: petoxColors.text,
  },
  subtitle: {
    ...petoxTextBase,
    marginTop: 10,
    fontSize: 13,
    color: petoxColors.hint,
  },
  stepper: {
    marginTop: 56,
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
  amount: { ...petoxTextBase, fontSize: 26, color: petoxColors.text },
  chips: {
    marginTop: 36,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
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
  chipLabelOn: { color: petoxColors.text },
  hint: {
    ...petoxTextBase,
    marginTop: 26,
    textAlign: 'center',
    fontSize: 13,
    color: petoxColors.greenDark,
  },
  spacer: { flex: 1, minHeight: 40 },
});
