import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { RECOMMENDED_APPS } from '@/api/settings';
import {
  getInstalledApps,
  installedAppsAvailable,
  type InstalledApp,
} from '@/features/apps/installedApps';
import { petoxColors, petoxTextBase } from '@/theme/petox';

// 네이티브 모듈이 없을 때(다시 빌드 전 등) 보여줄 최소 목록
const FALLBACK: InstalledApp[] = [
  { packageName: 'com.google.android.youtube', label: 'YouTube', icon: null },
  { packageName: 'com.instagram.android', label: 'Instagram', icon: null },
  { packageName: 'com.zhiliaoapp.musically', label: 'TikTok', icon: null },
];

type Props = {
  selected: string[];
  onChange: (next: string[]) => void;
  style?: StyleProp<ViewStyle>;
};

/**
 * 감지 앱 고르기 — 폰에 설치된 앱 전체 + 검색. 숏폼 추천 앱은 맨 위에 "추천".
 * 온보딩(감지 앱 선택)과 마이페이지(감지 앱 관리)에서 같이 쓴다.
 */
export function AppPicker({ selected, onChange, style }: Props) {
  const [apps, setApps] = useState<InstalledApp[] | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!installedAppsAvailable) {
      setApps(FALLBACK);
      return;
    }
    getInstalledApps()
      .then(list => setApps(list.length > 0 ? list : FALLBACK))
      .catch(() => setApps(FALLBACK));
  }, []);

  // 추천 앱(설치된 것) → 나머지 이름순. 검색은 앱 이름으로.
  const rows = useMemo(() => {
    if (!apps) return [];
    const q = query.trim().toLowerCase();
    const filtered = q
      ? apps.filter(a => a.label.toLowerCase().includes(q))
      : apps;
    const rec = filtered.filter(a => RECOMMENDED_APPS.includes(a.packageName));
    const rest = filtered.filter(
      a => !RECOMMENDED_APPS.includes(a.packageName),
    );
    return [...rec, ...rest];
  }, [apps, query]);

  const toggle = (pkg: string) =>
    onChange(
      selected.includes(pkg)
        ? selected.filter(p => p !== pkg)
        : [...selected, pkg],
    );

  return (
    <View style={[styles.box, style]}>
      <View style={styles.search}>
        <Text style={styles.searchIcon}>⌕</Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="앱 이름 검색"
          placeholderTextColor={petoxColors.hint}
          style={styles.searchInput}
          autoCorrect={false}
        />
      </View>

      {apps === null ? (
        <ActivityIndicator style={styles.loading} color={petoxColors.green} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={a => a.packageName}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Text style={styles.empty}>검색 결과가 없어요</Text>
          }
          renderItem={({ item }) => {
            const on = selected.includes(item.packageName);
            const rec = RECOMMENDED_APPS.includes(item.packageName);
            return (
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={item.label}
                onPress={() => toggle(item.packageName)}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              >
                <View style={[styles.check, on && styles.checkOn]}>
                  {on && <Text style={styles.checkMark}>✓</Text>}
                </View>
                {item.icon ? (
                  <Image source={{ uri: item.icon }} style={styles.icon} />
                ) : (
                  <View style={[styles.icon, styles.iconBlank]} />
                )}
                <Text style={styles.label} numberOfLines={1}>
                  {item.label}
                </Text>
                {rec && <Text style={styles.rec}>추천</Text>}
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flex: 1,
    borderRadius: 24,
    backgroundColor: '#F2F4F1',
    paddingTop: 14,
    overflow: 'hidden',
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 14,
    height: 40,
    borderRadius: 20,
    backgroundColor: petoxColors.white,
    paddingHorizontal: 14,
  },
  searchIcon: { fontSize: 18, color: petoxColors.hint, marginRight: 6 },
  searchInput: {
    ...petoxTextBase,
    flex: 1,
    fontSize: 14,
    color: petoxColors.text,
    paddingVertical: 0,
  },
  loading: { marginTop: 40 },
  listContent: { paddingHorizontal: 18, paddingTop: 6, paddingBottom: 12 },
  empty: {
    ...petoxTextBase,
    marginTop: 30,
    textAlign: 'center',
    fontSize: 13,
    color: petoxColors.hint,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#DEE2DC',
  },
  pressed: { opacity: 0.6 },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#5C5C5C',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  checkOn: {
    borderColor: petoxColors.green,
    backgroundColor: petoxColors.green,
  },
  checkMark: { color: petoxColors.white, fontSize: 13, fontWeight: '700' },
  icon: { width: 36, height: 36, borderRadius: 9, marginRight: 12 },
  iconBlank: { backgroundColor: '#DADADA' },
  label: { ...petoxTextBase, flex: 1, fontSize: 15, color: petoxColors.text },
  rec: {
    ...petoxTextBase,
    fontSize: 11,
    color: petoxColors.greenDark,
    marginLeft: 8,
  },
});
