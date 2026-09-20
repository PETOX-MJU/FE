import React, { useState } from 'react';
import {
  KeyboardTypeOptions,
  StyleSheet,
  TextInput,
  View,
  ViewStyle,
} from 'react-native';
import { petoxColors, petoxTextBase } from '@/theme/petox';

type Props = {
  value: string;
  onChangeText: (next: string) => void;
  hint: string;
  keyboardType?: KeyboardTypeOptions;
  isPassword?: boolean;
  style?: ViewStyle;
};

/**
 * 회원가입 폼 디자인에 맞춘 밑줄형 입력칸:
 * 힌트는 회색, 아래 얇은 선은 포커스 시 초록으로 바뀝니다.
 */
export function PetoxTextField({
  value,
  onChangeText,
  hint,
  keyboardType = 'default',
  isPassword = false,
  style,
}: Props) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.wrapper, style]}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={hint}
        placeholderTextColor={petoxColors.hint}
        style={styles.input}
        keyboardType={keyboardType}
        secureTextEntry={isPassword}
        autoCapitalize="none"
        autoCorrect={false}
        selectionColor={petoxColors.green}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      <View
        style={[
          styles.line,
          { backgroundColor: focused ? petoxColors.green : petoxColors.line },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { width: '100%' },
  input: {
    ...petoxTextBase,
    width: '100%',
    fontSize: 16,
    color: petoxColors.text,
    paddingVertical: 8,
    paddingHorizontal: 0,
  },
  line: { height: 1, marginTop: 8 },
});
