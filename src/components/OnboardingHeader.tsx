import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { WalkingDog } from '@/components/WalkingDog';
import { petoxColors } from '@/theme/petox';

const TRACK_HEIGHT = 12;
const DOG_SIZE = 48;
const BACK_SIZE = 44; // 뒤로가기 터치 영역 (정사각형)
const CHEVRON = 14; // 화살표 한 변 길이

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
        hitSlop={8}
        style={styles.backHit}>
        {/* 글자(‹)는 폰트마다 세로 위치가 달라 진행바와 줄이 안 맞아서, 선으로 그립니다. */}
        <View style={styles.chevron} />
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
  backHit: {
    width: BACK_SIZE,
    height: BACK_SIZE,
    marginLeft: -12, // 화살표 자체는 화면 여백 선에 맞추고 터치 영역만 바깥으로
    marginRight: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevron: {
    width: CHEVRON,
    height: CHEVRON,
    marginLeft: CHEVRON / 3, // 45° 회전 후 시각적 중심 보정
    borderLeftWidth: 3,
    borderBottomWidth: 3,
    borderColor: petoxColors.text,
    transform: [{ rotate: '45deg' }],
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
