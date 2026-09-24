import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { showDialog } from '@/components/AppDialog';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppPicker } from '@/components/AppPicker';
import { BoneButton } from '@/components/BoneButton';
import { OnboardingHeader } from '@/components/OnboardingHeader';
import { loadSelectedApps, saveSelectedApps } from '@/api/settings';
import { onboardingStrings as S } from '@/constants/onboardingStrings';
import { petoxColors, petoxLayout, petoxTextBase } from '@/theme/petox';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'OnboardingApps'>;

/** 온보딩 3단계 — 감지 앱 선택. 폰에 설치된 앱 중 숏폼을 보는 앱을 고른다. */
export function OnboardingAppsScreen({ navigation, route }: Props) {
  const { goalMinutes, blockSlots } = route.params;
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // 처음엔 추천 앱(유튜브·인스타·틱톡)이 골라져 있다
  useEffect(() => {
    loadSelectedApps()
      .then(setSelected)
      .catch(() => {});
  }, []);

  const next = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await saveSelectedApps(selected);
      navigation.navigate('OnboardingCharacter', { goalMinutes, blockSlots });
    } catch {
      showDialog({
        title: '저장 실패',
        message: '잠시 후 다시 시도해 주세요.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.body}>
        <OnboardingHeader
          step={3}
          total={5}
          onBack={() => navigation.goBack()}
        />

        <Text style={styles.title}>감지 앱 선택</Text>
        <Text style={styles.subtitle}>
          숏폼을 보는 앱을 골라 주세요. 인스타그램·유튜브를 많이 선택해요!
        </Text>

        <AppPicker
          selected={selected}
          onChange={setSelected}
          style={styles.picker}
        />

        <BoneButton
          text={S.next}
          disabled={selected.length === 0 || saving}
          onPress={next}
          style={styles.button}
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
    lineHeight: 19,
    color: petoxColors.hint,
  },
  picker: { marginTop: 20 },
  button: { marginTop: 20 },
});
