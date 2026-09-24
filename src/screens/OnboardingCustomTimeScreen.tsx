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

// 타임라인 24칸 = 0시~24시. 칸 h 는 h:00 ~ h+1:00 이라 끝 시각은 24(= 자정)까지 간다.
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

  // 시작 0~23시, 끝 1~24시 (마지막 칸 23:00~24:00 도 고를 수 있게).
  // 끝이 시작보다 이르면 자정을 넘겨 다음날까지 이어지는 구간이다 (예: 23:00 ~ 02:00).
  const startHours = Array.from({ length: HOURS }, (_, i) => i); // 0~23
  const endHours = Array.from({ length: HOURS }, (_, i) => i + 1); // 1~24

  /** 타임라인을 끌어 값이 바뀌면 휠도 같은 위치로 옮깁니다. */
  const syncWheels = (s: number, e: number) => {
    startRef.current?.scrollTo({ y: s * BOX_H, animated: true });
    endRef.current?.scrollTo({ y: (e - 1) * BOX_H, animated: true });
  };

  // 시작 = 끝(0시간)만 막고, 나머지는 끝이 더 일러도 그대로 둔다 → 자정 넘김
  const applyStart = (h: number) => {
    const s = clamp(h, 0, HOURS - 1);
    setStart(s);
    if (s === end % HOURS) {
      const e = s + 1;
      setEnd(e);
      endRef.current?.scrollTo({ y: (e - 1) * BOX_H, animated: true });
    }
  };

  const applyEnd = (h: number) => {
    const e = clamp(h, 1, HOURS);
    setEnd(e);
    if (e % HOURS === start) {
      const s = e - 1;
      setStart(s);
      startRef.current?.scrollTo({ y: s * BOX_H, animated: true });
    }
  };

  const overnight = end <= start;
  const hours = overnight ? end + HOURS - start : end - start;
  const inRange = (h: number) =>
    overnight ? h >= start || h < end : h >= start && h < end;

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
        const h = hourAtScreenX(g.x0);
        anchor.current = h;
        setStart(h);
        setEnd(h + 1);
        syncWheels(h, h + 1);
      },
      onPanResponderMove: (_e, g) => {
        const h = hourAtScreenX(g.moveX);
        const a = anchor.current;
        const s = Math.min(a, h);
        const e = clamp(Math.max(a, h) + 1, s + 1, HOURS);
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
            total={5}
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
                inRange(h) && styles.slotOn,
                h === HOURS - 1 && styles.slotLast,
              ]}
            />
          ))}
        </View>
        <View style={styles.axis}>
          <Text style={styles.axisLabel}>{S.customTimeStartLabel}</Text>
          <Text style={styles.axisLabel}>{S.customTimeEndLabel}</Text>
        </View>

        {/* 고른 구간 요약 + 사용법 */}
        <Text style={styles.summary}>
          {S.customTimeSummary(
            `${pad(start)} ~ ${overnight ? '다음날 ' : ''}${pad(end)}`,
            hours,
          )}
        </Text>
        <View style={styles.howTo}>
          {S.customTimeHowTo.map(line => (
            <Text key={line} style={styles.howToText}>
              {'· '}
              {line}
            </Text>
          ))}
        </View>

        <View style={styles.spacer} />

        <BoneButton
          text={fromSettings ? '추가하기' : S.next}
          onPress={() => {
            const range = `${pad(start)}~${pad(end)}`;
            if (fromSettings) {
              navigation.popTo('BlockTimeSettings', { addSlot: range });
            } else {
              navigation.navigate('OnboardingApps', {
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
    lineHeight: 19,
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
  summary: {
    ...petoxTextBase,
    marginTop: 28,
    textAlign: 'center',
    fontSize: 17,
    color: petoxColors.greenDark,
  },
  howTo: {
    marginTop: 18,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: '#F2F9F1',
    gap: 4,
  },
  howToText: {
    ...petoxTextBase,
    fontSize: 13,
    lineHeight: 19,
    color: petoxColors.hint,
  },
  spacer: { flex: 1, minHeight: 40 },
});
