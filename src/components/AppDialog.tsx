import React, { useEffect, useState } from 'react';
import type { ImageSourcePropType } from 'react-native';
import { ConfirmModal } from '@/components/ConfirmModal';

// 앱 어디서든 부를 수 있는 앱 스타일 알림창 — 기본 Alert.alert 대신 쓴다.
// 화면을 옮겨도(navigation.replace 등) 떠 있도록 최상단(RootNavigator)에 한 번만 깔아 둔다.
//
//   showDialog({ title: '저장 실패', message: '잠시 후 다시 시도해 주세요.' });
//   showDialog({ title: '삭제할까요?', confirmText: '삭제', cancelText: '취소', onConfirm: ... });

export type DialogOptions = {
  title: string;
  message?: string;
  image?: ImageSourcePropType;
  /** 기본 '확인' */
  confirmText?: string;
  confirmColor?: string;
  /** 주면 취소 버튼이 생긴다. 없으면 확인 버튼 하나 */
  cancelText?: string;
  onConfirm?: () => void | Promise<void>;
  /** 취소·바깥 누르기·뒤로가기로 닫혔을 때 */
  onCancel?: () => void;
};

let show: ((o: DialogOptions) => void) | null = null;

export function showDialog(options: DialogOptions) {
  if (show) show(options);
  else console.warn('AppDialogHost 가 아직 없어요', options.title);
}

export function AppDialogHost() {
  const [dialog, setDialog] = useState<DialogOptions | null>(null);

  useEffect(() => {
    show = setDialog;
    return () => {
      show = null;
    };
  }, []);

  return (
    <ConfirmModal
      visible={dialog !== null}
      title={dialog?.title ?? ''}
      message={dialog?.message}
      image={dialog?.image}
      confirmText={dialog?.confirmText ?? '확인'}
      confirmColor={dialog?.confirmColor}
      cancelText={dialog?.cancelText ?? null}
      onCancel={() => {
        const d = dialog;
        setDialog(null);
        d?.onCancel?.();
      }}
      onConfirm={async () => {
        const d = dialog;
        setDialog(null);
        await d?.onConfirm?.();
      }}
    />
  );
}
