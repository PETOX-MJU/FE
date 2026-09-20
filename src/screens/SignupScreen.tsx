import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PetoxBlackButton } from '@/components/PetoxButtons';
import { PetoxLogo } from '@/components/PetoxLogo';
import { PetoxTextField } from '@/components/PetoxTextField';
import { petoxStrings } from '@/constants/petoxStrings';
import { isValidEmail } from '@/constants/validation';
import { petoxColors, petoxLayout, petoxTextBase } from '@/theme/petox';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Signup'>;

export function SignupScreen({ navigation }: Props) {
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const onSubmit = () => {
    // 세 칸 모두 채워야 가입이 진행됩니다.
    if (nickname.trim().length === 0) {
      setError(petoxStrings.signupErrorNickname);
      return;
    }
    if (!isValidEmail(email)) {
      setError(petoxStrings.signupErrorEmail);
      return;
    }
    if (password.length === 0) {
      setError(petoxStrings.signupErrorPassword);
      return;
    }
    // TODO: 백엔드 연동 지점 — 이 payload 로 회원가입 API(src/api) 호출 후 이동.
    const payload = { nickname, email, password };
    console.log('[Petox] signup payload', payload);
    // 가입 직후에는 홈이 아니라 온보딩으로.
    navigation.navigate('OnboardingGoal');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled">
          <PetoxLogo height={56} />
          <Text style={styles.subtitle}>{petoxStrings.signupSubtitle}</Text>

          <PetoxTextField
            value={nickname}
            onChangeText={next => {
              setNickname(next);
              setError(null);
            }}
            hint={petoxStrings.signupNicknameHint}
            style={styles.firstField}
          />
          <PetoxTextField
            value={email}
            onChangeText={next => {
              setEmail(next);
              setError(null);
            }}
            hint={petoxStrings.signupEmailHint}
            keyboardType="email-address"
            style={styles.field}
          />
          <PetoxTextField
            value={password}
            onChangeText={next => {
              setPassword(next);
              setError(null);
            }}
            hint={petoxStrings.signupPasswordHint}
            isPassword
            style={styles.field}
          />

          {error !== null && <Text style={styles.error}>{error}</Text>}

          <PetoxBlackButton
            text={petoxStrings.signupSubmit}
            onPress={onSubmit}
            style={styles.submit}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: petoxColors.white },
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: petoxLayout.screenPadding,
    paddingTop: 64,
    paddingBottom: 24,
  },
  subtitle: {
    ...petoxTextBase,
    marginTop: 12,
    color: petoxColors.hint,
    fontSize: 14,
  },
  error: {
    ...petoxTextBase,
    alignSelf: 'flex-start',
    marginTop: 12,
    color: petoxColors.greenDark,
    fontSize: 13,
  },
  firstField: { marginTop: 48 },
  field: { marginTop: 28 },
  submit: { marginTop: 48 },
});
