import React, { useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BoneButton } from '@/components/BoneButton';
import { OnboardingHeader } from '@/components/OnboardingHeader';
import { PetoxTextField } from '@/components/PetoxTextField';
import { PetSprite } from '@/components/PetSprite';
import { onboardingStrings as S } from '@/constants/onboardingStrings';
import { savePetProfile } from '@/storage/petProfile';
import { petoxColors, petoxLayout, petoxTextBase } from '@/theme/petox';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'OnboardingConfirm'>;

const SPRITE = 220;

const SPOTLIGHT_W = 240;

export function OnboardingConfirmScreen({ navigation, route }: Props) {
  const { goalMinutes, blockSlots, pet, generatedUri } = route.params;
  const [name, setName] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const onSubmit = async () => {
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      setError(S.confirmErrorName);
      return;
    }
    if (saving) return;

    setSaving(true);
    try {
      // TODO: 백엔드 연동 지점 — 서버에도 같은 내용을 올립니다.
      await savePetProfile({
        name: trimmed,
        pet,
        generatedUri,
        goalMinutes,
        blockSlots,
        createdAt: new Date().toISOString(),
      });
      console.log('[Petox] pet registered', trimmed);
      navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
    } catch {
      setSaving(false);
      Alert.alert('저장 실패', S.confirmErrorSave);
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
          <OnboardingHeader
            step={4}
            total={4}
            onBack={() => navigation.goBack()}
          />

          <Text style={styles.title}>{S.confirmTitle}</Text>

          <View style={styles.stage}>
            <Image
              source={require('../assets/images/spotlight.png')}
              style={styles.spotlight}
              resizeMode="contain"
            />
            {/* 사진 변환 결과가 있으면 그것을, 기본 캐릭터를 골랐으면 그 캐릭터를. */}
            {generatedUri !== undefined ? (
              <Image
                source={{ uri: generatedUri }}
                style={styles.generated}
                resizeMode="contain"
              />
            ) : pet !== undefined ? (
              <PetSprite pet={pet} size={SPRITE} />
            ) : null}
          </View>

          <PetoxTextField
            value={name}
            onChangeText={next => {
              setName(next);
              setError(null);
            }}
            hint={S.confirmNameHint}
            style={styles.field}
          />

          {error !== null && <Text style={styles.error}>{error}</Text>}

          <View style={styles.spacer} />

          <BoneButton text={S.confirmSubmit} onPress={onSubmit} />
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
    paddingHorizontal: petoxLayout.screenPadding,
    paddingBottom: 32,
  },
  title: {
    ...petoxTextBase,
    marginTop: 44,
    fontSize: 21,
    color: petoxColors.text,
  },
  stage: {
    marginTop: 40,
    height: 240,
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
  generated: { width: SPRITE, height: SPRITE },
  error: {
    ...petoxTextBase,
    alignSelf: 'flex-start',
    marginTop: 12,
    color: petoxColors.greenDark,
    fontSize: 13,
  },
  field: { marginTop: 36 },
  spacer: { flex: 1, minHeight: 40 },
});
