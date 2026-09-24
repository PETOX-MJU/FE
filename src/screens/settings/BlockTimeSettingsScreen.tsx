import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { showDialog } from '@/components/AppDialog';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BoneButton } from '@/components/BoneButton';
import { ScreenHeader } from '@/components/ScreenHeader';
import { fetchBlockSlots, saveBlockSlots } from '@/api/settings';
import { BLOCK_SLOTS } from '@/constants/onboardingStrings';
import { petoxColors, petoxLayout, petoxTextBase } from '@/theme/petox';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'BlockTimeSettings'>;

const PRESET_IDS: string[] = BLOCK_SLOTS.map(s => s.id);

/**
 * 마이페이지 > 시간대 설정. 온보딩 2단계와 같은 추천 시간대 카드 + 직접 추가한 시간대 목록.
 * 직접 추가는 온보딩의 시간 고르기 화면을 그대로 쓰고, 고른 값을 route 파라미터로 돌려받는다.
 */
export function BlockTimeSettingsScreen({ navigation, route }: Props) {
  const [slots, setSlots] = useState<string[] | null>(null);
  const [saved, setSaved] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchBlockSlots()
      .then(s => {
        setSlots(s);
        setSaved(s);
      })
      .catch(() => setSlots([]));
  }, []);

  // 직접 추가 화면에서 돌아오면 목록에 붙인다 (같은 구간은 한 번만)
  const added = route.params?.addSlot;
  useEffect(() => {
    if (!added) return;
    setSlots(prev => (prev && !prev.includes(added) ? [...prev, added] : prev));
    navigation.setParams({ addSlot: undefined });
  }, [added, navigation]);

  const toggle = (id: string) =>
    setSlots(prev =>
      prev
        ? prev.includes(id)
          ? prev.filter(v => v !== id)
          : [...prev, id]
        : prev,
    );

  const custom = (slots ?? []).filter(s => !PRESET_IDS.includes(s));
  const changed =
    slots !== null &&
    (slots.length !== saved.length || slots.some(s => !saved.includes(s)));

  const save = async () => {
    if (!slots || saving) return;
    setSaving(true);
    try {
      await saveBlockSlots(slots);
      navigation.goBack();
    } catch {
      showDialog({
        title: '저장 실패',
        message: '온보딩을 마친 뒤에 바꿀 수 있어요.',
      });
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader title="시간대 설정" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.subtitle}>
          이 시간대엔 숏폼을 보면 펫이 나타나요.
        </Text>

        <Text style={styles.section}>추천 시간대</Text>
        <View style={styles.cards}>
          {BLOCK_SLOTS.map(slot => {
            const on = slots?.includes(slot.id) ?? false;
            return (
              <Pressable
                key={slot.id}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={() => toggle(slot.id)}
                style={[styles.card, on && styles.cardOn]}
              >
                <Text style={styles.icon}>{slot.icon}</Text>
                <View style={styles.cardText}>
                  <Text style={styles.cardLabel}>{slot.label}</Text>
                  <Text style={styles.cardRange}>{slot.range}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.section}>직접 설정한 시간대</Text>
        {custom.length === 0 && <Text style={styles.empty}>아직 없어요</Text>}
        {custom.map(range => (
          <View key={range} style={styles.customRow}>
            <Text style={styles.customRange}>{range}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${range} 삭제`}
              hitSlop={10}
              onPress={() => toggle(range)}
            >
              <Text style={styles.remove}>삭제</Text>
            </Pressable>
          </View>
        ))}
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            navigation.navigate('OnboardingCustomTime', { fromSettings: true })
          }
          style={styles.addHit}
        >
          <Text style={styles.add}>+ 시간대 직접 추가</Text>
        </Pressable>
      </ScrollView>

      <View style={styles.footer}>
        <BoneButton
          text="저장하기"
          disabled={!changed || (slots?.length ?? 0) === 0 || saving}
          onPress={save}
        />
        {slots?.length === 0 && (
          <Text style={styles.warn}>시간대를 하나 이상 골라 주세요</Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: petoxColors.white },
  body: { paddingHorizontal: petoxLayout.screenPadding, paddingBottom: 24 },
  subtitle: {
    ...petoxTextBase,
    marginTop: 24,
    fontSize: 13,
    color: petoxColors.hint,
  },
  section: {
    ...petoxTextBase,
    marginTop: 28,
    fontSize: 16,
    color: petoxColors.text,
  },
  cards: { marginTop: 12, flexDirection: 'row', gap: 12 },
  card: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#BFE0BD',
    backgroundColor: petoxColors.white,
  },
  cardOn: {
    borderColor: petoxColors.green,
    borderWidth: 2,
    backgroundColor: '#F2F9F1',
  },
  icon: { fontSize: 18, marginRight: 8 },
  cardText: { flexShrink: 1 },
  cardLabel: { ...petoxTextBase, fontSize: 13, color: petoxColors.text },
  cardRange: {
    ...petoxTextBase,
    marginTop: 3,
    fontSize: 11,
    color: petoxColors.greenDark,
  },
  empty: {
    ...petoxTextBase,
    marginTop: 12,
    fontSize: 13,
    color: petoxColors.hint,
  },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E6E6E6',
  },
  customRange: { ...petoxTextBase, fontSize: 15, color: petoxColors.text },
  remove: { ...petoxTextBase, fontSize: 13, color: '#E45759' },
  addHit: { alignSelf: 'flex-start', marginTop: 14, paddingVertical: 6 },
  add: { ...petoxTextBase, fontSize: 14, color: petoxColors.greenDark },
  footer: {
    paddingHorizontal: petoxLayout.screenPadding,
    paddingBottom: 32,
    paddingTop: 8,
  },
  warn: {
    ...petoxTextBase,
    marginTop: 8,
    textAlign: 'center',
    fontSize: 12,
    color: '#E45759',
  },
});
