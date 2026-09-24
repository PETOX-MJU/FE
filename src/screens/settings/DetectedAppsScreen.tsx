import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenHeader } from '@/components/ScreenHeader';
import {
  fetchDetectedApps,
  setDetectedAppEnabled,
  type DetectedApp,
} from '@/api/settings';
import { syncOverlay } from '@/features/overlay/overlay';
import { petoxColors, petoxLayout, petoxTextBase } from '@/theme/petox';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'DetectedApps'>;

/**
 * 마이페이지 > 감지 앱 관리. 켜 둔 앱을 볼 때만 펫이 나타나고, 미션도 이 앱들 기준으로 잡힌다.
 * 누르는 즉시 저장한다. 하나도 안 켜면 감지할 게 없어서 마지막 하나는 못 끈다.
 */
export function DetectedAppsScreen({ navigation }: Props) {
  const [apps, setApps] = useState<DetectedApp[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetchDetectedApps()
      .then(setApps)
      .catch(() => setFailed(true));
  }, []);

  const toggle = (app: DetectedApp) => async (on: boolean) => {
    if (!apps) return;
    if (!on && apps.filter(a => a.enabled).length <= 1) {
      Alert.alert('감지 앱', '최소 한 개의 앱은 켜 두어야 해요.');
      return;
    }
    const prev = apps;
    setApps(apps.map(a => (a.id === app.id ? { ...a, enabled: on } : a)));
    try {
      await setDetectedAppEnabled(app.id, on);
      syncOverlay().catch(() => {}); // 펫 오버레이가 바로 새 목록을 보도록
    } catch {
      setApps(prev);
      Alert.alert('저장 실패', '잠시 후 다시 시도해 주세요.');
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader title="감지 앱 관리" onBack={() => navigation.goBack()} />
      <View style={styles.body}>
        <Text style={styles.subtitle}>
          켜 둔 앱에서 숏폼을 오래 보면 펫이 나타나요.
        </Text>

        {apps === null && !failed && (
          <ActivityIndicator style={styles.loading} color={petoxColors.green} />
        )}
        {failed && (
          <Text style={styles.error}>
            목록을 불러오지 못했어요. 잠시 후 다시 열어 주세요.
          </Text>
        )}

        {apps?.map(app => (
          <View key={app.id} style={styles.row}>
            <Text style={styles.name}>{app.name}</Text>
            <Switch
              value={app.enabled}
              onValueChange={toggle(app)}
              trackColor={{ false: '#D9D9D9', true: petoxColors.green }}
              thumbColor={petoxColors.white}
            />
          </View>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: petoxColors.white },
  body: { flex: 1, paddingHorizontal: petoxLayout.screenPadding },
  subtitle: {
    ...petoxTextBase,
    marginTop: 24,
    marginBottom: 12,
    fontSize: 13,
    color: petoxColors.hint,
  },
  loading: { marginTop: 40 },
  error: {
    ...petoxTextBase,
    marginTop: 40,
    textAlign: 'center',
    fontSize: 13,
    color: '#E45759',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E6E6E6',
  },
  name: { ...petoxTextBase, fontSize: 16, color: petoxColors.text },
});
