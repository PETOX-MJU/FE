import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BoneButton } from '@/components/BoneButton';
import { PetHero } from '@/components/PetHero';
import { WelcomeDog } from '@/components/WelcomeDog';
import { fetchNickname } from '@/api/profile';
import { onboardingStrings as S } from '@/constants/onboardingStrings';
import { petoxColors, petoxLayout, petoxTextBase } from '@/theme/petox';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'OnboardingWelcome'>;

/**
 * 회원가입 직후, 온보딩 1단계로 들어가기 전에 보여주는 안내 화면.
 * 가입을 환영하고, 이어지는 온보딩 설정으로 안내합니다.
 * 가입 폼으로 되돌아가지 않도록 뒤로가기 버튼은 두지 않습니다.
 */
export function OnboardingWelcomeScreen({ navigation, route }: Props) {
  // 가입 직후엔 파라미터로 받고, 이메일 인증 후 로그인해서 온 경우엔 계정에서 읽는다.
  const [nickname, setNickname] = useState(route.params?.nickname?.trim());
  useEffect(() => {
    if (nickname) return;
    fetchNickname()
      .then(n => n && setNickname(n))
      .catch(() => {});
    // 처음 한 번만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.body}>
        <View style={styles.hero}>
          {/* 개발 모드: 강아지를 길게 누르면 가입 인증 대기 화면 미리보기 */}
          <PetHero>
            <Pressable
              disabled={!__DEV__}
              onLongPress={() =>
                navigation.navigate('EmailConfirmWait', {
                  email: 'preview@petox.dev',
                  nickname: nickname ?? '',
                })
              }
            >
              <WelcomeDog />
            </Pressable>
          </PetHero>
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
  // 강아지 자리는 PetHero 가 잡는다 (가입 인증 대기 화면과 같은 위치)
  hero: { alignItems: 'center' },
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
