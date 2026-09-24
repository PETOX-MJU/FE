import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PetoxBlackButton } from '@/components/PetoxButtons';
import { AuthHeader } from '@/components/AuthHeader';
import { PetoxTextField } from '@/components/PetoxTextField';
import { petoxStrings } from '@/constants/petoxStrings';
import { isValidEmail } from '@/constants/validation';
import {
  authErrorMessage,
  routeAfterLogin,
  signInWithEmail,
} from '@/api/auth';
import { petoxColors, petoxLayout, petoxTextBase } from '@/theme/petox';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'EmailLogin'>;

export function EmailLoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    if (submitting) return;
    if (!isValidEmail(email)) {
      setError(petoxStrings.emailLoginErrorEmail);
      return;
    }
    if (password.length === 0) {
      setError(petoxStrings.emailLoginErrorPassword);
      return;
    }

    setSubmitting(true);
    try {
      await signInWithEmail(email, password);
      // 온보딩을 끝내지 않았으면 홈 대신 온보딩으로 보낸다.
      const next = await routeAfterLogin();
      navigation.reset({ index: 0, routes: [{ name: next }] });
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
          {/* 상단: 로고 + 부제 */}
          <AuthHeader text={petoxStrings.emailLoginSubtitle} />

          {/* 입력 폼 */}
          <PetoxTextField
            value={email}
            onChangeText={next => {
              setEmail(next);
              setError(null);
            }}
            hint={petoxStrings.emailLoginEmailHint}
            keyboardType="email-address"
            style={styles.firstField}
          />
          <PetoxTextField
            value={password}
            onChangeText={next => {
              setPassword(next);
              setError(null);
            }}
            hint={petoxStrings.emailLoginPasswordHint}
            isPassword
            style={styles.field}
          />

          {error !== null && <Text style={styles.error}>{error}</Text>}

          {/* 남는 공간을 밀어내 버튼을 하단으로 */}
          <View style={styles.spacer} />

          {/* 하단: 로그인 버튼 + 회원가입 링크 */}
          <PetoxBlackButton
            text={submitting ? petoxStrings.loggingIn : petoxStrings.emailLoginSubmit}
            onPress={onSubmit}
            disabled={submitting}
          />
          <Text
            style={styles.toSignup}
            onPress={() => navigation.navigate('Signup')}>
            {petoxStrings.emailLoginToSignup}
          </Text>
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
    paddingTop: 0, // 로고 자리는 AuthHeader 가 잡는다 (로그인 첫 화면과 같은 위치)
    paddingBottom: 97,
  },
  firstField: { marginTop: 42 },
  field: { marginTop: 12 },
  error: {
    ...petoxTextBase,
    alignSelf: 'flex-start',
    marginTop: 12,
    color: petoxColors.greenDark,
    fontSize: 13,
  },
  spacer: { flex: 1, minHeight: 56 },
  toSignup: {
    ...petoxTextBase,
    marginTop: 14,
    color: petoxColors.hint,
    fontSize: 13,
  },
});
