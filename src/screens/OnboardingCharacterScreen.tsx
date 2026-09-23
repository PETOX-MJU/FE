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

const SPRITE = 200;
const SPRITE_W = 175;   // 좌측 상단 칸만 비율을 깨고 너비 축소
const SPOTLIGHT_W = 180;   // 셀 폭(약 205dp) 안에 들어오도록

export function OnboardingCharacterScreen({ navigation, route }: Props) {
  const { goalMinutes, blockSlots } = route.params;
  const [pet, setPet] = useState<PetId>('golden');

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.body}>
        <OnboardingHeader step={3} total={4} onBack={() => navigation.goBack()} />

        <Text style={styles.title}>{S.characterTitle}</Text>
        <Text style={styles.subtitle}>{S.characterSubtitle}</Text>

        <View style={styles.grid}>
          {PETS.map((p, i) => {
            const on = p.id === pet;
            return (
              <Pressable
                key={p.id}
                accessibilityRole="button"
                accessibilityLabel={p.name}
                onPress={() => setPet(p.id)}
                style={styles.cell}>
                {on && (
                  <Image
                    source={require('../assets/images/spotlight.png')}
                    style={styles.spotlight}
                    resizeMode="contain"
                  />
                )}
                <PetSprite
                  pet={p.id}
                  size={SPRITE}
                  width={i === 0 ? SPRITE_W : undefined}
                />
              </Pressable>
            );
          })}
        </View>

        <View style={styles.spacer} />

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
  grid: {
    marginTop: 24,
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 16,
  },
  cell: {
    width: '50%',
    height: SPRITE + 8,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  // 조명 원본(design/조명.png)은 3:2 비율.
  spotlight: {
    position: 'absolute',
    top: 0,
    alignSelf: 'center',
    width: SPOTLIGHT_W,
    height: SPOTLIGHT_W / 1.5,
  },
  spacer: { flex: 1, minHeight: 20 },
  photoBtn: { marginTop: 10 },
});
