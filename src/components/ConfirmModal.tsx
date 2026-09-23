import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { petoxColors, petoxTextBase } from '@/theme/petox';

type Props = {
  visible: boolean;
  title: string;
  message?: string;
  confirmText: string;
  cancelText?: string;
  /** 확인 버튼 색 (기본: 브랜드 초록) */
  confirmColor?: string;
  onCancel: () => void;
  onConfirm: () => Promise<void> | void;
};

/**
 * 예/아니오 확인 팝업. EditTextModal 과 같은 카드 스타일이라
 * 앱 기본 Alert 대신 이걸 쓰면 화면 톤이 맞는다 (로그아웃 등).
 */
export function ConfirmModal({
  visible,
  title,
  message,
  confirmText,
  cancelText = '취소',
  confirmColor = petoxColors.green,
  onCancel,
  onConfirm,
}: Props) {
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) setBusy(false);
  }, [visible]);

  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          <View style={styles.buttons}>
            <Pressable
              onPress={onCancel}
              style={({ pressed }) => [
                styles.button,
                styles.cancel,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.cancelText}>{cancelText}</Text>
            </Pressable>
            <Pressable
              onPress={confirm}
              disabled={busy}
              style={({ pressed }) => [
                styles.button,
                { backgroundColor: confirmColor },
                (pressed || busy) && styles.pressed,
              ]}
            >
              <Text style={styles.confirmText}>{confirmText}</Text>
            </Pressable>
          </View>
        </View>
      </View>
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
  message: {
    ...petoxTextBase,
    marginTop: 10,
    fontSize: 14,
    lineHeight: 20,
    color: '#6C6C6C',
  },
  buttons: { flexDirection: 'row', gap: 10, marginTop: 20 },
  button: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancel: { backgroundColor: '#F1F1F1' },
  pressed: { opacity: 0.7 },
  cancelText: { ...petoxTextBase, fontSize: 15, color: petoxColors.text },
  confirmText: { ...petoxTextBase, fontSize: 15, color: petoxColors.white },
});
