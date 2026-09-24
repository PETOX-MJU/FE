import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { showDialog } from '@/components/AppDialog';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BoneButton } from '@/components/BoneButton';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SlotGrid } from '@/components/SlotGrid';
import { addSlot, fullyCovered, slotLabel } from '@/features/blockTime/slots';
import { fetchBlockSlots, saveBlockSlots } from '@/api/settings';
import { petoxColors, petoxLayout, petoxTextBase } from '@/theme/petox';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'BlockTimeSettings'>;

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
  const replaced = route.params?.replaceSlot;
  useEffect(() => {
    if (!added) return;
    setSlots(prev => {
      if (!prev) return prev;
      // 수정이면 원래 구간을 빼고 새 구간을 넣는다
      const base = replaced ? prev.filter(s => s !== replaced) : prev;
      const r = addSlot(base, added);
      if (r.removed.length > 0) {
        showDialog({
          title: '겹치는 시간대를 정리했어요',
          message: `${r.removed
            .map(slotLabel)
            .join(', ')}은(는) ${added} 안에 들어가서 뺐어요.`,
        });
      }
      return r.list;
    });
    navigation.setParams({ addSlot: undefined, replaceSlot: undefined });
  }, [added, replaced, navigation]);

  // 켜려는 추천 시간대가 이미 고른 구간 안에 다 들어가면 켜지 않는다
  const toggle = (id: string) => {
    if (!slots) return;
    if (slots.includes(id)) {
      setSlots(slots.filter(v => v !== id));
    } else if (fullyCovered(id, slots)) {
      showDialog({
        title: `${slotLabel(id)}은(는) 이미 포함돼 있어요`,
        message: '고른 다른 시간대 안에 이 시간이 다 들어가 있어요.',
      });
    } else {
      setSlots(addSlot(slots, id).list);
    }
  };

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

        <View style={styles.grid}>
          <SlotGrid
            selected={slots ?? []}
            onToggle={toggle}
            onAdd={() =>
              navigation.navigate('OnboardingCustomTime', {
                fromSettings: true,
                existing: slots ?? [],
              })
            }
            onEdit={range =>
              navigation.navigate('OnboardingCustomTime', {
                fromSettings: true,
                edit: range,
                existing: (slots ?? []).filter(s => s !== range),
              })
            }
          />
        </View>
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
  grid: { marginTop: 20 },
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
