import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppPicker } from '@/components/AppPicker';
import { BoneButton } from '@/components/BoneButton';
import { ScreenHeader } from '@/components/ScreenHeader';
import { loadSelectedApps, saveSelectedApps } from '@/api/settings';
import { syncOverlay } from '@/features/overlay/overlay';
import { petoxColors, petoxLayout, petoxTextBase } from '@/theme/petox';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'DetectedApps'>;

/** 마이페이지 > 감지 앱 관리. 온보딩과 같은 앱 고르기 화면에 저장 버튼. */
export function DetectedAppsScreen({ navigation }: Props) {
  const [selected, setSelected] = useState<string[] | null>(null);
  const [saved, setSaved] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSelectedApps()
      .then(list => {
        setSelected(list);
        setSaved(list);
      })
      .catch(() => setSelected([]));
  }, []);

  const changed =
    selected !== null &&
    (selected.length !== saved.length ||
      selected.some(p => !saved.includes(p)));

  const save = async () => {
    if (!selected || saving) return;
    setSaving(true);
    try {
      await saveSelectedApps(selected);
      syncOverlay().catch(() => {}); // 펫 오버레이가 바로 새 목록을 보도록
      navigation.goBack();
    } catch {
      Alert.alert('저장 실패', '잠시 후 다시 시도해 주세요.');
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader title="감지 앱 관리" onBack={() => navigation.goBack()} />
      <View style={styles.body}>
        <Text style={styles.subtitle}>
          고른 앱에서 숏폼을 오래 보면 펫이 나타나요.
        </Text>
        {selected !== null && (
          <AppPicker
            selected={selected}
            onChange={setSelected}
            style={styles.picker}
          />
        )}
        <BoneButton
          text="저장하기"
          disabled={!changed || (selected?.length ?? 0) === 0 || saving}
          onPress={save}
          style={styles.button}
        />
        {selected?.length === 0 && (
          <Text style={styles.warn}>앱을 하나 이상 골라 주세요</Text>
        )}
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
  subtitle: {
    ...petoxTextBase,
    marginTop: 20,
    fontSize: 13,
    color: petoxColors.hint,
  },
  picker: { marginTop: 16 },
  button: { marginTop: 20 },
  warn: {
    ...petoxTextBase,
    marginTop: 8,
    textAlign: 'center',
    fontSize: 12,
    color: '#E45759',
  },
});
