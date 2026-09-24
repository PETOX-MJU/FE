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
import { authErrorMessage, signUpWithEmail } from '@/api/auth';
import { petoxColors, petoxLayout, petoxTextBase } from '@/theme/petox';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Signup'>;

export function SignupScreen({ navigation }: Props) {
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    if (submitting) return;
    // 세 칸 모두 채워야 가입이 진행됩니다.
    const trimmedNickname = nickname.trim();
    if (trimmedNickname.length === 0) {
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
    // Supabase 최소 비밀번호 길이(BE supabase/config.toml minimum_password_length = 6)
    if (password.length < 6) {
      setError(petoxStrings.signupErrorPasswordShort);
      return;
    }

    setSubmitting(true);
    try {
      const result = await signUpWithEmail(trimmedNickname, email, password);
      if (result.status === 'needsEmailConfirm') {
        // 이메일 인증이 켜진 프로젝트: 세션이 없으므로 인증 후 로그인하도록 로그인 화면으로.
        // 이메일 인증이 켜진 프로젝트: 인증 대기 화면에서 인증되면 바로 로그인 → 온보딩.
        navigation.replace('EmailConfirmWait', {
          email: email.trim(),
          nickname: trimmedNickname,
        });
        return;
      }
      // 가입 직후에는 홈이 아니라 온보딩 안내 화면으로.
      // replace: 가입이 끝난 뒤 뒤로가기로 가입 폼에 돌아오지 않게 합니다.
      navigation.replace('OnboardingWelcome', { nickname: trimmedNickname });
    } catch (e) {
      setError(authErrorMessage(e));
      setSubmitting(false);
    }
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
            text={submitting ? petoxStrings.signingUp : petoxStrings.signupSubmit}
            onPress={onSubmit}
            disabled={submitting}
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
