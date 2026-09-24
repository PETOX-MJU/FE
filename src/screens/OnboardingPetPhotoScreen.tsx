import React, { useState } from 'react';
import {
  Alert,
  Image,
  PermissionsAndroid,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  launchCamera,
  launchImageLibrary,
  type ImagePickerResponse,
} from 'react-native-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BoneButton } from '@/components/BoneButton';
import { OnboardingHeader } from '@/components/OnboardingHeader';
import { onboardingStrings as S } from '@/constants/onboardingStrings';
import { petoxColors, petoxLayout, petoxTextBase } from '@/theme/petox';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'OnboardingPetPhoto'>;

export function OnboardingPetPhotoScreen({ navigation, route }: Props) {
  const { goalMinutes, blockSlots } = route.params;
  // 첨부된 사진의 로컬 경로. 사진 선택 기능을 붙이면 여기에 채웁니다.
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const hasPhoto = photoUri !== null;

  /** 피커 결과에서 사진 경로만 꺼냅니다. */
  const applyResult = (res: ImagePickerResponse) => {
    if (res.didCancel) return;
    if (res.errorCode) {
      Alert.alert('사진을 불러오지 못했어요', res.errorMessage ?? res.errorCode);
      return;
    }
    const uri = res.assets?.[0]?.uri;
    if (uri) setPhotoUri(uri);
  };

  /** 카메라는 런타임 권한이 필요합니다(앨범은 시스템 선택기라 불필요). */
  const ensureCameraPermission = async () => {
    if (Platform.OS !== 'android') return true;
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.CAMERA,
      {
        title: '카메라 권한',
        message: '반려동물 사진을 찍으려면 카메라 권한이 필요해요.',
        buttonPositive: '확인',
        buttonNegative: '취소',
      },
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  };

  const takePhoto = async () => {
    if (!(await ensureCameraPermission())) {
      Alert.alert('카메라 권한이 필요해요', '설정에서 권한을 허용해 주세요.');
      return;
    }
    const res = await launchCamera({
      mediaType: 'photo',
      saveToPhotos: false,
      quality: 0.9,
    });
    applyResult(res);
  };

  const choosePhoto = async () => {
    const res = await launchImageLibrary({
      mediaType: 'photo',
      selectionLimit: 1,
      quality: 0.9,
    });
    applyResult(res);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.body}>
        <OnboardingHeader step={4} total={5} onBack={() => navigation.goBack()} />

        <Text style={styles.title}>{S.petPhotoTitle}</Text>

        {/* 사진 미리보기 (점선 테두리) */}
        <View style={styles.dropzone}>
          {hasPhoto ? (
            <Image
              source={{ uri: photoUri }}
              style={styles.preview}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.placeholder}>
              <Text style={styles.placeholderText}>
                {S.petPhotoPlaceholder}
              </Text>
            </View>
          )}
        </View>

        {/* 사진 가져오기 */}
        <View style={styles.pickRow}>
          <Pressable
            accessibilityRole="button"
            onPress={takePhoto}
            style={({ pressed }) => [styles.pickBtn, pressed && styles.pressed]}>
            <Text style={styles.pickLabel}>{S.petPhotoCamera}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={choosePhoto}
            style={({ pressed }) => [styles.pickBtn, pressed && styles.pressed]}>
            <Text style={styles.pickLabel}>{S.petPhotoAlbum}</Text>
          </Pressable>
        </View>

        {/* 안내 */}
        <Text style={styles.guideTitle}>{S.petPhotoGuideTitle}</Text>
        <Text style={styles.guideLine}>{S.petPhotoGuide1}</Text>
        <Text style={styles.guideLine}>{S.petPhotoGuide2}</Text>

        <View style={styles.spacer} />

        {/* 사진이 없으면 안내만, 있으면 다음 단계로 */}
        <BoneButton
          text={S.petPhotoSubmit}
          variant={hasPhoto ? 'filled' : 'outline'}
          onPress={() => {
            if (!hasPhoto) return;
            navigation.navigate('OnboardingConvert', { goalMinutes, blockSlots });
          }}
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
    paddingBottom: 54,
  },
  title: {
    ...petoxTextBase,
    marginTop: 37,
    fontSize: 21,
    lineHeight: 30,
    color: petoxColors.text,
  },
  dropzone: {
    marginTop: 50,
    padding: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: petoxColors.line,
    borderRadius: 14,
  },
  placeholder: {
    height: 167,
    borderRadius: 10,
    backgroundColor: '#E2E2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    ...petoxTextBase,
    fontSize: 12,
    color: '#9A9A9A',
  },
  preview: { height: 167, borderRadius: 10, width: '100%' },
  pickRow: { marginTop: 35, flexDirection: 'row', gap: 12 },
  pickBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BFE0BD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.75 },
  pickLabel: {
    ...petoxTextBase,
    fontSize: 13,
    color: petoxColors.text,
  },
  guideTitle: {
    ...petoxTextBase,
    marginTop: 28,
    fontSize: 12,
    color: petoxColors.hint,
  },
  guideLine: {
    ...petoxTextBase,
    marginTop: 6,
    fontSize: 11,
    lineHeight: 16,
    color: petoxColors.hint,
  },
  spacer: { flex: 1, minHeight: 32 },
});
