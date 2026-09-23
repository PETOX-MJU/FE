import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { petoxColors, petoxTextBase } from '@/theme/petox';

type Props = {
  visible: boolean;
  title: string;
  initialValue: string;
  placeholder?: string;
  maxLength?: number;
  onCancel: () => void;
  /** 저장 중 에러를 던지면 창을 닫지 않고 그대로 둔다. */
  onSave: (value: string) => Promise<void> | void;
};

/** 한 줄 입력 팝업 (이름·닉네임 변경 등). 안드로이드엔 Alert.prompt 가 없어 직접 만든다. */
export function EditTextModal({
  visible,
  title,
  initialValue,
  placeholder,
  maxLength = 12,
  onCancel,
  onSave,
}: Props) {
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 처음엔 지금 값을 회색으로 보여주고, 입력칸을 눌러야 검정으로 바뀌며 수정된다.
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (visible) {
      setValue(initialValue);
      setError(null);
      setSaving(false);
      setFocused(false);
    }
  }, [visible, initialValue]);

  const trimmed = value.trim();
  const canSave =
    trimmed.length > 0 && trimmed !== initialValue.trim() && !saving;

  const submit = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await onSave(trimmed);
    } catch {
      setError('저장하지 못했어요. 다시 시도해 주세요.');
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <TextInput
            value={value}
            onChangeText={next => {
              setValue(next);
              setError(null);
            }}
            placeholder={placeholder}
            placeholderTextColor={petoxColors.hint}
            maxLength={maxLength}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            returnKeyType="done"
            onSubmitEditing={submit}
            selectionColor={petoxColors.green}
            style={[
              styles.input,
              focused ? styles.inputFocused : styles.inputIdle,
            ]}
          />
          <Text style={styles.counter}>
            {trimmed.length}/{maxLength}
          </Text>
          {error !== null && <Text style={styles.error}>{error}</Text>}
          <View style={styles.buttons}>
            <Pressable
              onPress={onCancel}
              style={[styles.button, styles.cancel]}
            >
              <Text style={styles.cancelText}>취소</Text>
            </Pressable>
            <Pressable
              onPress={submit}
              disabled={!canSave}
              style={[styles.button, styles.save, !canSave && styles.disabled]}
            >
              <Text style={styles.saveText}>
                {saving ? '저장 중…' : '저장'}
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
    padding: 32,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 20,
    backgroundColor: petoxColors.white,
    padding: 22,
  },
  title: { ...petoxTextBase, fontSize: 18, color: petoxColors.text },
  input: {
    ...petoxTextBase,
    marginTop: 16,
    fontSize: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  inputIdle: { color: petoxColors.hint, borderBottomColor: petoxColors.line },
  inputFocused: {
    color: petoxColors.text,
    borderBottomColor: petoxColors.green,
  },
  counter: {
    ...petoxTextBase,
    alignSelf: 'flex-end',
    marginTop: 6,
    fontSize: 12,
    color: petoxColors.hint,
  },
  error: { ...petoxTextBase, marginTop: 6, fontSize: 13, color: '#E45759' },
  buttons: { flexDirection: 'row', gap: 10, marginTop: 18 },
  button: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancel: { backgroundColor: '#F1F1F1' },
  save: { backgroundColor: petoxColors.green },
  disabled: { opacity: 0.4 },
  cancelText: { ...petoxTextBase, fontSize: 15, color: petoxColors.text },
  saveText: { ...petoxTextBase, fontSize: 15, color: petoxColors.white },
});
