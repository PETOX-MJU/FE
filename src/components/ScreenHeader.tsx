import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { BackChevron } from '@/components/BackChevron';
import { petoxColors, petoxLayout, petoxTextBase } from '@/theme/petox';

/** 헤더 한 줄 높이. 아래 내용을 절대 좌표로 놓는 화면(마이페이지)이 이 값을 기준으로 삼는다. */
export const SCREEN_HEADER_HEIGHT = 40;
/** 상태바 아래 ~ 헤더 윗변 */
export const SCREEN_HEADER_TOP = 14;

type Props = {
  title: string;
  onBack: () => void;
  style?: ViewStyle;
};

/**
 * 뒤로가기 + 제목 헤더. 대시보드 기준 위치·크기로 통일한다
 * (화면 좌우 여백 24, 상태바 아래 14, 화살표와 제목 사이 14, 제목 28).
 * 부모가 이미 좌우 여백을 준 경우엔 style 로 paddingHorizontal: 0 을 넘긴다.
 */
export function ScreenHeader({ title, onBack, style }: Props) {
  return (
    <View style={[styles.header, style]}>
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="뒤로 가기"
        hitSlop={12}>
        <BackChevron />
      </Pressable>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    height: SCREEN_HEADER_HEIGHT,
    marginTop: SCREEN_HEADER_TOP,
    paddingHorizontal: petoxLayout.screenPadding,
  },
  title: { ...petoxTextBase, fontSize: 28, color: petoxColors.text },
});
