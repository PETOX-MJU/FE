import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BoneButton } from '@/components/BoneButton';
import { WalkingDog } from '@/components/WalkingDog';
import { onboardingStrings as S } from '@/constants/onboardingStrings';
import { petoxColors, petoxLayout, petoxTextBase } from '@/theme/petox';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'OnboardingWelcome'>;

const DOG_SIZE = 150;

/**
 * 회원가입 직후, 온보딩 1단계로 들어가기 전에 보여주는 안내 화면.
 * 가입을 환영하고, 이어지는 온보딩 설정으로 안내합니다.
 * 가입 폼으로 되돌아가지 않도록 뒤로가기 버튼은 두지 않습니다.
 */
export function OnboardingWelcomeScreen({ navigation, route }: Props) {
  const nickname = route.params?.nickname?.trim();

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.body}>
        <View style={styles.hero}>
          <WalkingDog size={DOG_SIZE} />
          <Text style={styles.title}>
            {nickname ? S.welcomeTitle(nickname) : S.welcomeTitleNoName}
          </Text>
          <Text style={styles.subtitle}>{S.welcomeSubtitle}</Text>
        </View>

        <View style={styles.spacer} />

        <BoneButton
          text={S.welcomeStart}
          onPress={() => navigation.navigate('OnboardingGoal')}
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
    paddingBottom: 48,
  },
  // 안내 문구만 있는 화면이라 가운데보다 살짝 위에 둡니다.
  hero: { alignItems: 'center', marginTop: 120 },
  title: {
    ...petoxTextBase,
    marginTop: 20,
    fontSize: 22,
    lineHeight: 31,
    textAlign: 'center',
    color: petoxColors.text,
  },
  subtitle: {
    ...petoxTextBase,
    marginTop: 10,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    color: petoxColors.hint,
  },
  spacer: { flex: 1, minHeight: 24 },
});
