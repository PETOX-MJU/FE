import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthError } from '@supabase/supabase-js';
import {
  authErrorMessage,
  clearPendingSignup,
  getPendingSignup,
  resendSignupEmail,
  routeAfterLogin,
  signInWithEmail,
} from '@/api/auth';
import { showDialog } from '@/components/AppDialog';
import { BoneButton } from '@/components/BoneButton';
import { MailDog } from '@/components/MailDog';
import { PetHero } from '@/components/PetHero';
import { petoxColors, petoxLayout, petoxTextBase } from '@/theme/petox';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'EmailConfirmWait'>;

/**
 * 가입 후 인증 메일 대기. 메일의 링크를 누르고 앱으로 돌아오면(또는 "인증했어요") 가입 때 입력한
 * 정보로 바로 로그인해 온보딩으로 보낸다 — 로그인 화면을 한 번 더 거치지 않게.
 * 가입 정보는 메모리에만 있어서, 앱을 껐다 켰으면 로그인 화면에서 직접 로그인한다.
 */
export function EmailConfirmWaitScreen({ navigation, route }: Props) {
  const { email, nickname } = route.params;
  const [checking, setChecking] = useState(false);
  const busy = useRef(false);

  const tryLogin = useCallback(
    async (silent: boolean) => {
      if (busy.current) return;
      const pending = getPendingSignup();
      if (!pending) {
        if (!silent) navigation.replace('EmailLogin');
        return;
      }
      busy.current = true;
      setChecking(true);
      try {
        await signInWithEmail(pending.email, pending.password);
        clearPendingSignup();
        const next = await routeAfterLogin();
        navigation.reset({
          index: 0,
          routes: [
            next === 'OnboardingWelcome'
              ? { name: next, params: { nickname } }
              : { name: next },
          ],
        });
      } catch (e) {
        if (!silent) {
          const notYet =
            e instanceof AuthError && e.code === 'email_not_confirmed';
          showDialog({
            title: notYet ? '아직 인증 전이에요' : '로그인하지 못했어요',
            message: notYet
              ? '메일의 인증 링크를 누른 뒤 다시 눌러 주세요.'
              : authErrorMessage(e),
          });
        }
      } finally {
        busy.current = false;
        setChecking(false);
      }
    },
    [navigation, nickname],
  );

  // 메일 앱·브라우저에서 인증하고 돌아오면 자동으로 확인한다.
  useEffect(() => {
    const sub = AppState.addEventListener('change', s => {
      if (s === 'active') tryLogin(true);
    });
    return () => sub.remove();
  }, [tryLogin]);

  const resend = async () => {
    try {
      await resendSignupEmail(email);
      showDialog({ title: '메일을 다시 보냈어요', message: email });
    } catch (e) {
      showDialog({ title: '보내지 못했어요', message: authErrorMessage(e) });
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.body}>
        <View style={styles.hero}>
          <PetHero>
            <MailDog />
          </PetHero>
          <Text style={styles.title}>메일함을 확인해 주세요</Text>
          <Text style={styles.email}>{email}</Text>
          <Text style={styles.subtitle}>
            보낸 메일의 인증 링크를 누르고{'\n'}앱으로 돌아오면 바로 시작해요.
          </Text>
        </View>

        <View style={styles.spacer} />

        <BoneButton
          text={checking ? '확인 중…' : '인증했어요'}
          disabled={checking}
          onPress={() => tryLogin(false)}
        />
        <View style={styles.links}>
          <Pressable accessibilityRole="button" hitSlop={8} onPress={resend}>
            <Text style={styles.link}>메일 다시 보내기</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => {
              clearPendingSignup();
              navigation.replace('EmailLogin');
            }}
          >
            <Text style={styles.link}>로그인 화면으로</Text>
          </Pressable>
        </View>
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
  // 강아지 자리는 PetHero 가 잡는다 (온보딩 환영 화면과 같은 위치)
  hero: { alignItems: 'center' },
  title: {
    ...petoxTextBase,
    marginTop: 20,
    fontSize: 22,
    lineHeight: 31,
    textAlign: 'center',
    color: petoxColors.text,
  },
  email: {
    ...petoxTextBase,
    marginTop: 12,
    fontSize: 15,
    color: petoxColors.greenDark,
  },
  subtitle: {
    ...petoxTextBase,
    marginTop: 12,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    color: petoxColors.hint,
  },
  spacer: { flex: 1, minHeight: 24 },
  links: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 28,
  },
  link: { ...petoxTextBase, fontSize: 13, color: petoxColors.hint },
});
