import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BoneButton } from '@/components/BoneButton';
import { OnboardingHeader } from '@/components/OnboardingHeader';
import { PetSprite } from '@/components/PetSprite';
import {
  PETS,
  onboardingStrings as S,
  type PetId,
} from '@/constants/onboardingStrings';
import { petoxColors, petoxLayout, petoxTextBase } from '@/theme/petox';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'OnboardingCharacter'>;

// 시안 기준 크기. 화면이 작으면 남는 높이에 맞춰 같은 비율로 줄인다
// (고정 200 이면 작은 화면에서 아래 버튼이 화면 밖으로 밀려났다).
const SPRITE_MAX = 230;
const SPRITE_W_RATIO = 175 / 200; // 좌측 상단 칸만 비율을 깨고 너비 축소
// 조명(3:2) 너비 = 스프라이트 × 1.0 → 높이 ≈ 스프라이트 × 0.67.
// 꼭짓점은 머리 위, 아래 끝은 발끝에 오도록 강아지를 감싼다.
const SPOTLIGHT_RATIO = 1.0;
// 스프라이트 PNG(정사각형)는 강아지 위로 약 17%, 아래로 약 29% 가 투명 여백이라
// 그대로 쌓으면 펫끼리 멀어 보인다. 칸을 강아지 부분만큼만 잡고 그림은 여백만큼 겹쳐 놓는다.
const CELL_H_RATIO = 0.62; // 칸 높이 = 스프라이트 × 0.62 (강아지 몸 + 약간의 숨 쉴 틈)
const CELL_W_RATIO = 0.62; // 칸 너비 = 스프라이트 × 0.62
const SPRITE_TOP_RATIO = -0.13; // 그림을 위로 당겨 머리 위 여백을 칸 밖으로
const COL_GAP_RATIO = 0.12;
const SPOTLIGHT_TOP_RATIO = -0.1;
const TOP_ROW_LIFT_RATIO = 0.08; // 윗줄을 스프라이트 × 0.08 만큼 위로
const ROW_GAP = 8;

export function OnboardingCharacterScreen({ navigation, route }: Props) {
  const { goalMinutes, blockSlots } = route.params;
  const [pet, setPet] = useState<PetId>('golden');
  const [gridH, setGridH] = useState(0);

  // 제목과 버튼 사이에 남는 높이를 두 줄로 나눠 스프라이트 크기를 정한다.
  const fitH = gridH > 0 ? (gridH - ROW_GAP) / 2 / CELL_H_RATIO : SPRITE_MAX;
  const sprite = Math.max(100, Math.min(SPRITE_MAX, fitH));
  const cellW = sprite * CELL_W_RATIO;
  const cellH = sprite * CELL_H_RATIO;
  const spotlightW = sprite * SPOTLIGHT_RATIO;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.body}>
        <OnboardingHeader
          step={3}
          total={4}
          onBack={() => navigation.goBack()}
        />

        <Text style={styles.title}>{S.characterTitle}</Text>
        <Text style={styles.subtitle}>{S.characterSubtitle}</Text>

        <View
          style={styles.gridArea}
          onLayout={e => setGridH(e.nativeEvent.layout.height)}
        >
          {/* 2마리씩 두 줄. flexWrap 에 맡기면 소수점 반올림으로 한 줄에 1마리만 들어가
              세로로 쏟아져서, 줄을 직접 나눈다. */}
          {[PETS.slice(0, 2), PETS.slice(2, 4)].map((row, r) => (
            <View
              key={r}
              style={[
                styles.row,
                // 윗줄을 아랫줄보다 위에 그려서, 아랫줄 조명이 넘쳐도 윗줄 강아지를 가리지 않게 한다.
                { columnGap: sprite * COL_GAP_RATIO, zIndex: 2 - r },
                r > 0 && styles.rowGap,
                // 윗줄만 살짝 위로 — 아랫줄 조명이 들어갈 틈을 벌린다.
                r === 0 && {
                  transform: [{ translateY: -sprite * TOP_ROW_LIFT_RATIO }],
                },
              ]}
            >
              {row.map((p, j) => {
                const i = r * 2 + j;
                const on = p.id === pet;
                return (
                  <Pressable
                    key={p.id}
                    accessibilityRole="button"
                    accessibilityLabel={p.name}
                    onPress={() => setPet(p.id)}
                    style={[styles.cell, { width: cellW, height: cellH }]}
                  >
                    {on && (
                      <Image
                        source={require('../assets/images/spotlight.png')}
                        style={[
                          styles.spotlight,
                          {
                            // 꼭짓점이 머리 조금 위에서 시작해 발끝까지 덮는다.
                            // 윗줄 발과 살짝 겹치는 꼭짓점은 윗줄이 앞에 그려져 가려진다.
                            top: sprite * SPOTLIGHT_TOP_RATIO,
                            width: spotlightW,
                            height: spotlightW / 1.5,
                          },
                        ]}
                        resizeMode="contain"
                      />
                    )}
                    <PetSprite
                      pet={p.id}
                      size={sprite}
                      width={i === 0 ? sprite * SPRITE_W_RATIO : undefined}
                      style={[
                        styles.sprite,
                        { top: sprite * SPRITE_TOP_RATIO },
                      ]}
                    />
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>

        <BoneButton
          text={S.next}
          onPress={() =>
            navigation.navigate('OnboardingConfirm', {
              goalMinutes,
              blockSlots,
              pet,
            })
          }
        />
        <BoneButton
          text={S.characterFromPhoto}
          icon={require('../assets/images/camera.png')}
          variant="outline"
          style={styles.photoBtn}
          onPress={() =>
            navigation.navigate('OnboardingPetPhoto', {
              goalMinutes,
              blockSlots,
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
    paddingBottom: 48, // 버튼이 화면 아래에 붙지 않도록
  },
  title: {
    ...petoxTextBase,
    marginTop: 44,
    fontSize: 21,
    color: petoxColors.text,
  },
  subtitle: {
    ...petoxTextBase,
    marginTop: 10,
    fontSize: 13,
    lineHeight: 19,
    color: petoxColors.hint,
  },
  // 제목 아래 ~ 버튼 위의 남는 공간 전체. 스프라이트는 이 높이에 맞춰 줄어든다.
  gridArea: {
    flex: 1,
    marginTop: 24,
    marginBottom: 16,
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', justifyContent: 'center' },
  rowGap: { marginTop: ROW_GAP },
  cell: {
    alignItems: 'center',
    overflow: 'visible',
  },
  // 칸보다 큰 그림을 가운데 두고 투명 여백만 칸 밖으로 넘긴다.
  sprite: { position: 'absolute', alignSelf: 'center' },
  // 조명 원본(design/조명.png)은 3:2 비율.
  spotlight: {
    position: 'absolute',
    alignSelf: 'center',
  },
  photoBtn: { marginTop: 10 },
});
