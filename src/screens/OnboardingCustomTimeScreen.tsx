import React, { useEffect, useRef, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BoneButton } from '@/components/BoneButton';
import { OnboardingHeader } from '@/components/OnboardingHeader';
import { ScreenHeader } from '@/components/ScreenHeader';
import { onboardingStrings as S } from '@/constants/onboardingStrings';
import { petoxColors, petoxLayout, petoxTextBase } from '@/theme/petox';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'OnboardingCustomTime'>;

const HOURS = 24;
const BOX_H = 46; // 시각 박스 = 휠 한 칸 높이

const pad = (h: number) => `${String(h).padStart(2, '0')}:00`;
const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

type ScrollRef = React.RefObject<React.ComponentRef<typeof ScrollView> | null>;

type WheelProps = {
  /** 휠에 표시할 시각 목록 */
  hours: number[];
  value: number;
  onChange: (hour: number) => void;
  scrollRef: ScrollRef;
};

/** 위아래로 굴려 시각을 고르는 휠. 한 번에 한 칸만 보입니다. */
function HourWheel({ hours, value, onChange, scrollRef }: WheelProps) {
  useEffect(() => {
    // 첫 렌더 때 현재 값 위치로 맞춰둡니다.
    const index = hours.indexOf(value);
    if (index >= 0) {
      scrollRef.current?.scrollTo({ y: index * BOX_H, animated: false });
    }
    // 최초 1회만.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSettle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = clamp(
      Math.round(e.nativeEvent.contentOffset.y / BOX_H),
      0,
      hours.length - 1,
    );
    onChange(hours[index]);
  };

  return (
    <View style={styles.timeBox}>
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={BOX_H}
        decelerationRate="fast"
        nestedScrollEnabled
        onMomentumScrollEnd={onSettle}
        onScrollEndDrag={onSettle}
      >
        {hours.map(h => (
          <View key={h} style={styles.wheelItem}>
            <Text style={styles.timeText}>{pad(h)}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

export function OnboardingCustomTimeScreen({ navigation, route }: Props) {
  const { goalMinutes = 60, fromSettings = false } = route.params ?? {};
  const [start, setStart] = useState(1);
  const [end, setEnd] = useState(3);

  const startRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const endRef = useRef<React.ComponentRef<typeof ScrollView>>(null);

  // 시작은 마지막 시각 앞까지, 끝은 시작 다음부터.
  const startHours = Array.from({ length: HOURS - 1 }, (_, i) => i); // 0~22
  const endHours = Array.from({ length: HOURS - 1 }, (_, i) => i + 1); // 1~23

  /** 타임라인을 끌어 값이 바뀌면 휠도 같은 위치로 옮깁니다. */
  const syncWheels = (s: number, e: number) => {
    startRef.current?.scrollTo({ y: s * BOX_H, animated: true });
    endRef.current?.scrollTo({ y: (e - 1) * BOX_H, animated: true });
  };

  const applyStart = (h: number) => {
    const s = clamp(h, 0, HOURS - 2);
    const e = Math.max(end, s + 1);
    setStart(s);
    setEnd(e);
    if (e !== end) {
      endRef.current?.scrollTo({ y: (e - 1) * BOX_H, animated: true });
    }
  };

  const applyEnd = (h: number) => {
    const e = clamp(h, 1, HOURS - 1);
    const s = Math.min(start, e - 1);
    setEnd(e);
    setStart(s);
    if (s !== start) {
      startRef.current?.scrollTo({ y: s * BOX_H, animated: true });
    }
  };

  // 드래그로 구간 선택. locationX 는 눌린 자식 칸 기준이라 부정확하므로
  // 트랙의 화면상 위치를 재두고 제스처의 절대 좌표로 계산합니다.
  const trackRef = useRef<React.ComponentRef<typeof View>>(null);
  const trackBox = useRef({ x: 0, w: 0 });
  const anchor = useRef(1);

  const measureTrack = () => {
    trackRef.current?.measureInWindow((x: number, _y: number, w: number) => {
      trackBox.current = { x, w };
    });
  };

  const hourAtScreenX = (screenX: number) => {
    const { x, w } = trackBox.current;
    if (w <= 0) return 0;
    const ratio = (screenX - x) / w;
    return clamp(Math.floor(ratio * HOURS), 0, HOURS - 1);
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (_e, g) => {
        const h = clamp(hourAtScreenX(g.x0), 0, HOURS - 2);
        anchor.current = h;
        setStart(h);
        setEnd(h + 1);
        syncWheels(h, h + 1);
      },
      onPanResponderMove: (_e, g) => {
        const h = hourAtScreenX(g.moveX);
        const a = anchor.current;
        const s = Math.min(a, h);
        const e = clamp(Math.max(a, h) + 1, s + 1, HOURS - 1);
        setStart(s);
        setEnd(e);
        syncWheels(s, e);
      },
    }),
  ).current;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.body}>
        {/* 마이페이지 > 시간대 설정에서 열면 진행바 대신 일반 헤더 */}
        {fromSettings ? (
          <ScreenHeader
            title="시간대 직접 추가"
            onBack={() => navigation.goBack()}
            style={styles.settingsHeader}
          />
        ) : (
          <OnboardingHeader
            step={2}
            total={4}
            onBack={() => navigation.goBack()}
          />
        )}

        {!fromSettings && <Text style={styles.title}>{S.blockTitle}</Text>}
        <Text style={styles.subtitle}>{S.customTimeSubtitle}</Text>

        {/* 시작 ~ 종료 (위아래로 굴려서 조절) */}
        <View style={styles.timeRow}>
          <HourWheel
            hours={startHours}
            value={start}
            onChange={applyStart}
            scrollRef={startRef}
          />
          <Text style={styles.tilde}>~</Text>
          <HourWheel
            hours={endHours}
            value={end}
            onChange={applyEnd}
            scrollRef={endRef}
          />
        </View>

        {/* 0~23시 타임라인. 끌어서 구간을 고릅니다. */}
        <View
          ref={trackRef}
          style={styles.track}
          onLayout={measureTrack}
          {...pan.panHandlers}
        >
          {Array.from({ length: HOURS }, (_, h) => (
            <View
              key={h}
              style={[
                styles.slot,
                h >= start && h < end && styles.slotOn,
                h === HOURS - 1 && styles.slotLast,
              ]}
            />
          ))}
        </View>
        <View style={styles.axis}>
          <Text style={styles.axisLabel}>{S.customTimeStartLabel}</Text>
          <Text style={styles.axisLabel}>{S.customTimeEndLabel}</Text>
        </View>

        <View style={styles.spacer} />

        <BoneButton
          text={fromSettings ? '추가하기' : S.next}
          onPress={() => {
            const range = `${pad(start)}~${pad(end)}`;
            if (fromSettings) {
              navigation.popTo('BlockTimeSettings', { addSlot: range });
            } else {
              navigation.navigate('OnboardingCharacter', {
                goalMinutes,
                blockSlots: [range],
              });
            }
          }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: petoxColors.white },
  // body 가 이미 좌우 여백을 준다
  settingsHeader: { paddingHorizontal: 0 },
  body: {
    flex: 1,
    paddingHorizontal: petoxLayout.screenPadding,
    paddingBottom: 32,
  },
  title: {
    ...petoxTextBase,
    marginTop: 44,
    fontSize: 21,
    lineHeight: 30,
    color: petoxColors.text,
  },
  subtitle: {
    ...petoxTextBase,
    marginTop: 10,
    fontSize: 13,
    color: petoxColors.hint,
  },
  timeRow: {
    marginTop: 72,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeBox: {
    width: 116,
    height: BOX_H,
    borderRadius: BOX_H / 2,
    borderWidth: 1.5,
    borderColor: petoxColors.text,
    overflow: 'hidden',
  },
  wheelItem: {
    height: BOX_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeText: {
    ...petoxTextBase,
    fontSize: 20,
    color: petoxColors.text,
  },
  tilde: {
    ...petoxTextBase,
    marginHorizontal: 18,
    fontSize: 18,
    color: petoxColors.text,
  },
  track: {
    marginTop: 40,
    flexDirection: 'row',
    height: 22,
    borderWidth: 1,
    borderColor: petoxColors.line,
    backgroundColor: '#F2F2F2',
  },
  slot: {
    flex: 1,
    borderRightWidth: 1,
    borderRightColor: petoxColors.line,
  },
  slotLast: { borderRightWidth: 0 },
  slotOn: { backgroundColor: petoxColors.green },
  axis: {
    marginTop: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    // 트랙 끝보다 살짝 바깥으로 빼서 양끝 라벨을 벌립니다.
    marginHorizontal: -8,
  },
  axisLabel: {
    ...petoxTextBase,
    fontSize: 11,
    color: petoxColors.text,
  },
  spacer: { flex: 1, minHeight: 40 },
});
