import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BoneButton } from '@/components/BoneButton';
import { OnboardingHeader } from '@/components/OnboardingHeader';
import { SlotGrid } from '@/components/SlotGrid';
import { showDialog } from '@/components/AppDialog';
import {
  addSlot,
  fullyCovered,
  slotLabel,
} from '@/features/blockTime/slots';
import { onboardingStrings as S } from '@/constants/onboardingStrings';
import { petoxColors, petoxLayout, petoxTextBase } from '@/theme/petox';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'OnboardingBlockTime'>;

/** 새 구간이 기존 시간대를 통째로 품어서 빼 줬다고 알린다 */
function notifyMerged(removed: string[], range: string) {
  showDialog({
    title: '겹치는 시간대를 정리했어요',
    message: `${removed.map(slotLabel).join(', ')}은(는) ${range} 안에 들어가서 뺐어요.`,
  });
}

export function OnboardingBlockTimeScreen({ navigation, route }: Props) {
  const { goalMinutes } = route.params;
  // 추천 시간대 id + 직접 설정한 구간("HH:00~HH:00")을 함께 담는다
  const [selected, setSelected] = useState<string[]>([]);

  // 직접 설정 화면에서 돌아오면 목록에 더한다 (같은 구간은 한 번만)
  const added = route.params.addSlot;
  const replaced = route.params.replaceSlot;
  useEffect(() => {
    if (!added) return;
    setSelected(prev => {
      // 수정이면 원래 구간을 빼고 새 구간을 넣는다
      const base = replaced ? prev.filter(s => s !== replaced) : prev;
      const r = addSlot(base, added);
      if (r.removed.length > 0) notifyMerged(r.removed, added);
      return r.list;
    });
    navigation.setParams({ addSlot: undefined, replaceSlot: undefined });
  }, [added, replaced, navigation]);


  // 켜려는 추천 시간대가 이미 고른 구간 안에 다 들어가면 켜지 않는다
  const toggle = (id: string) => {
    if (selected.includes(id)) {
      setSelected(selected.filter(v => v !== id));
    } else if (fullyCovered(id, selected)) {
      showDialog({
        title: `${slotLabel(id)}은(는) 이미 포함돼 있어요`,
        message: '고른 다른 시간대 안에 이 시간이 다 들어가 있어요.',
      });
    } else {
      setSelected(addSlot(selected, id).list);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.body}>
        <OnboardingHeader step={2} total={5} onBack={() => navigation.goBack()} />

        <Text style={styles.title}>{S.blockTitle}</Text>
        <Text style={styles.subtitle}>{S.blockSubtitle}</Text>

        <View style={styles.cards}>
          <SlotGrid
            selected={selected}
            onToggle={toggle}
            onAdd={() =>
              navigation.navigate('OnboardingCustomTime', {
                goalMinutes,
                existing: selected,
              })
            }
            onEdit={range =>
              navigation.navigate('OnboardingCustomTime', {
                goalMinutes,
                edit: range,
                existing: selected.filter(s => s !== range),
              })
            }
          />
        </View>

        <View style={styles.spacer} />

        {/* 시간대를 하나 이상 골라야 다음으로 넘어갑니다. */}
        <BoneButton
          text={S.next}
          disabled={selected.length === 0}
          onPress={() =>
            navigation.navigate('OnboardingApps', {
              goalMinutes,
              blockSlots: selected,
            })
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
  // 소제목 바로 아래에 붙인다
  cards: { marginTop: 14 },
  spacer: { flex: 1, minHeight: 40 },
});
