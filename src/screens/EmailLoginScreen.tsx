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
import { PetoxLogo } from '@/components/PetoxLogo';
import { PetoxTextField } from '@/components/PetoxTextField';
import { petoxStrings } from '@/constants/petoxStrings';
import { isValidEmail } from '@/constants/validation';
import { petoxColors, petoxLayout, petoxTextBase } from '@/theme/petox';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'EmailLogin'>;

export function EmailLoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const onSubmit = () => {
    if (!isValidEmail(email)) {
      setError(petoxStrings.emailLoginErrorEmail);
      return;
    }
    if (password.length === 0) {
      setError(petoxStrings.emailLoginErrorPassword);
      return;
    }
    // TODO: 백엔드 연동 지점 — 실제 인증 API(src/api) 호출 후 성공 시 이동.
    // 지금은 클라이언트 유효성 검사만 통과하면 로그인 성공 처리.
    navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
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
          <PetoxLogo height={64} />
          <Text style={styles.subtitle}>{petoxStrings.emailLoginSubtitle}</Text>

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
            text={petoxStrings.emailLoginSubmit}
            onPress={onSubmit}
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
    paddingTop: 146,
    paddingBottom: 97,
  },
  subtitle: {
    ...petoxTextBase,
    marginTop: 34,
    color: petoxColors.text,
    fontSize: 15,
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
