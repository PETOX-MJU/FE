import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BoneButton } from '@/components/BoneButton';
import { OnboardingHeader } from '@/components/OnboardingHeader';
import { BLOCK_SLOTS, onboardingStrings as S } from '@/constants/onboardingStrings';
import { petoxColors, petoxLayout, petoxTextBase } from '@/theme/petox';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'OnboardingBlockTime'>;

export function OnboardingBlockTimeScreen({ navigation, route }: Props) {
  const { goalMinutes } = route.params;
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (id: string) =>
    setSelected(prev =>
      prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id],
    );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.body}>
        <OnboardingHeader step={2} total={5} onBack={() => navigation.goBack()} />

        <Text style={styles.title}>{S.blockTitle}</Text>
        <Text style={styles.subtitle}>{S.blockSubtitle}</Text>

        <View style={styles.cards}>
          {BLOCK_SLOTS.map(slot => {
            const on = selected.includes(slot.id);
            return (
              <Pressable
                key={slot.id}
                accessibilityRole="button"
                onPress={() => toggle(slot.id)}
                style={[styles.card, on && styles.cardOn]}>
                <Text style={styles.icon}>{slot.icon}</Text>
                <View style={styles.cardText}>
                  <Text style={styles.cardLabel}>{slot.label}</Text>
                  <Text style={styles.cardRange}>{slot.range}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate('OnboardingCustomTime', { goalMinutes })}
          style={styles.customHit}>
          <Text style={styles.custom}>{S.blockCustom}</Text>
        </Pressable>

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
  // '추천 시간대' 소제목 바로 아래에 붙인다
  cards: { marginTop: 14, flexDirection: 'row', gap: 12 },
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
  // 브랜드 폰트는 Regular 한 종류뿐이라 fontWeight 를 주면 기본 폰트로 떨어집니다.
  cardLabel: {
    ...petoxTextBase,
    fontSize: 13,
    color: petoxColors.text,
  },
  cardRange: {
    ...petoxTextBase,
    marginTop: 3,
    fontSize: 11,
    color: petoxColors.greenDark,
  },
  customHit: { alignSelf: 'center', marginTop: 18, padding: 8 },
  custom: { ...petoxTextBase, fontSize: 13, color: petoxColors.hint },
  spacer: { flex: 1, minHeight: 40 },
});
