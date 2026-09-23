import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { WalkingDog } from '@/components/WalkingDog';
import { petoxColors } from '@/theme/petox';

const TRACK_HEIGHT = 12;
const DOG_SIZE = 34;

type Props = {
  /** 현재 단계 (1부터) */
  step: number;
  /** 전체 단계 수 */
  total: number;
  onBack: () => void;
};

/** 뒤로가기 + 진행바. 강아지가 진행률을 따라 걸어갑니다. */
export function OnboardingHeader({ step, total, onBack }: Props) {
  const ratio = Math.min(Math.max(step / total, 0), 1);
  const pct = `${ratio * 100}%`;

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="뒤로"
        onPress={onBack}
        hitSlop={12}
        style={styles.backHit}>
        <Text style={styles.back}>‹</Text>
      </Pressable>

      <View style={styles.trackWrap}>
        <View style={styles.track}>
          <View style={[styles.fill, { width: pct }]} />
        </View>
        <WalkingDog
          size={DOG_SIZE}
          style={[styles.dog, { left: pct, marginLeft: -DOG_SIZE / 2 - 12 }]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: DOG_SIZE + 2, // 강아지가 바 위로 올라앉을 공간
  },
  backHit: { paddingRight: 12 },
  back: {
    fontSize: 30,
    lineHeight: 34,
    color: petoxColors.text,
  },
  trackWrap: { flex: 1, justifyContent: 'center' },
  track: {
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    backgroundColor: '#D9D9D9',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: TRACK_HEIGHT / 2,
    backgroundColor: petoxColors.green,
  },
  dog: {
    position: 'absolute',
    width: DOG_SIZE,
    height: DOG_SIZE,
    // 스프라이트 하단에 투명 여백이 약 10dp 있어 그만큼 내려야 발이 바에 닿습니다.
    bottom: 0,
  },
});
