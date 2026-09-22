import React, { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Svg, { Defs, LinearGradient, Line, Path, Polygon, Stop, Text as SvgText } from 'react-native-svg';
import preview from '@/data/screentimePreview.json';
import { monthCalendar, toDashboardModel } from '@/features/screentime/dashboard';
import { ATTENDANCE_KEY } from '@/hooks/useDailyPetReward';
import type { RootStackParamList } from '@/navigation/RootNavigator';
import { colors } from '@/theme/colors';
import { petoxColors, petoxFont, petoxLayout, petoxTextBase } from '@/theme/petox';

type Props = NativeStackScreenProps<RootStackParamList, 'ScreentimeDashboard'>;

// Figma 대시보드 스티커·그래프 색
const tone = {
  mission: '#E4C8F9',
  missionText: '#D29BF2',
  attendance: '#A9DDA2',
  summary: '#F6A19B',
  usage: '#BBD8F7',
  current: '#4DB6C7',
  previous: '#F6B24E',
  divider: '#EEEEEE',
};

const CHART_HEIGHT = 200;
const PAD = { left: 34, right: 8, top: 12, bottom: 28 };

/** 손으로 오린 라벨 모양 스티커 (Figma 섹션 제목). */
function Sticker({ label, color }: { label: string; color: string }) {
  return (
    <View style={styles.sticker}>
      <Svg style={StyleSheet.absoluteFill} viewBox="0 0 100 40" preserveAspectRatio="none">
        <Polygon
          points="4,6 56,1 97,5 99,30 94,38 40,36 2,39 0,20"
          fill={color}
          stroke={petoxColors.black}
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
      </Svg>
      <Text style={styles.stickerText}>{label}</Text>
    </View>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

// Catmull-Rom 을 3차 베지어로 바꿔 점들을 부드럽게 잇는다.
function smoothPath(values: number[], width: number, maxValue: number) {
  const chartWidth = width - PAD.left - PAD.right;
  const baseline = CHART_HEIGHT - PAD.bottom;
  const points = values.map((value, index) => ({
    x: PAD.left + (chartWidth * index) / Math.max(values.length - 1, 1),
    y: baseline - (value / maxValue) * (baseline - PAD.top),
  }));
  if (!points.length) return { points, line: '', area: '', baseline };
  let line = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    line += ` C ${p1.x + (p2.x - p0.x) / 6} ${p1.y + (p2.y - p0.y) / 6}, ${p2.x - (p3.x - p1.x) / 6} ${p2.y - (p3.y - p1.y) / 6}, ${p2.x} ${p2.y}`;
  }
  const area = `${line} L ${points[points.length - 1].x} ${baseline} L ${points[0].x} ${baseline} Z`;
  return { points, line, area, baseline };
}

function WeeklyChart({ width, current, previous, labels }: { width: number; current: number[]; previous: number[]; labels: string[] }) {
  const maxValue = Math.max(...current, ...previous, 1) * 1.15;
  const currentPath = smoothPath(current, width, maxValue);
  const previousPath = smoothPath(previous, width, maxValue);

  return (
    <Svg width={width} height={CHART_HEIGHT} accessibilityLabel="지난주와 이번 주 사용 시간 비교 그래프">
      <Defs>
        <LinearGradient id="currentFill" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={tone.current} stopOpacity="0.85" />
          <Stop offset="1" stopColor={tone.current} stopOpacity="0.05" />
        </LinearGradient>
        <LinearGradient id="previousFill" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={tone.previous} stopOpacity="0.45" />
          <Stop offset="1" stopColor={tone.previous} stopOpacity="0.05" />
        </LinearGradient>
      </Defs>
      {[0, 0.5, 1].map(ratio => {
        const y = PAD.top + (currentPath.baseline - PAD.top) * ratio;
        return (
          <React.Fragment key={ratio}>
            <Line x1={PAD.left} y1={y} x2={width - PAD.right} y2={y} stroke={tone.divider} />
            <SvgText x={0} y={y + 4} fontSize="10" fontFamily={petoxFont} fill={petoxColors.hint}>
              {Math.round(maxValue * (1 - ratio))}분
            </SvgText>
          </React.Fragment>
        );
      })}
      <Path d={previousPath.area} fill="url(#previousFill)" />
      <Path d={previousPath.line} fill="none" stroke={tone.previous} strokeWidth="1.5" />
      <Path d={currentPath.area} fill="url(#currentFill)" />
      <Path d={currentPath.line} fill="none" stroke={tone.current} strokeWidth="1.5" />
      {labels.map((label, index) => (
        <SvgText key={index} x={currentPath.points[index]?.x ?? 0} y={CHART_HEIGHT - 6} textAnchor="middle" fontSize="12" fontFamily={petoxFont} fill={petoxColors.hint}>
          {label}
        </SvgText>
      ))}
    </Svg>
  );
}

function useAttendance() {
  const [dates, setDates] = useState<string[]>([]);
  useEffect(() => {
    AsyncStorage.getItem(ATTENDANCE_KEY)
      .then(saved => setDates(saved ? JSON.parse(saved) : []))
      .catch(() => setDates([]));
  }, []);
  return dates;
}

export function ScreentimeDashboardScreen({ navigation }: Props) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const dashboard = useMemo(() => toDashboardModel(preview), []);
  const attendance = useAttendance();
  const calendar = useMemo(() => monthCalendar(new Date(), attendance), [attendance]);
  const chartWidth = width - petoxLayout.screenPadding * 2;
  const { mission } = dashboard;

  return (
    <View style={[styles.safeArea, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable onPress={navigation.goBack} accessibilityRole="button" accessibilityLabel="뒤로 가기" hitSlop={12}>
            <Text style={styles.back}>‹</Text>
          </Pressable>
          <Text style={styles.title}>대시보드</Text>
        </View>

        {mission.text && (
          <>
            <Sticker label="오늘의 미션" color={tone.mission} />
            <View style={styles.missionCard}>
              <Text style={styles.missionLabel}>미션 내용</Text>
              <Text style={styles.missionText}>{mission.text}</Text>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${mission.ratio * 100}%` }]} />
              </View>
              <Text style={styles.missionCaption}>{mission.caption}</Text>
            </View>
            <Divider />
          </>
        )}

        <View style={styles.sectionHeader}>
          <Sticker label="출석 체크" color={tone.attendance} />
          <Text style={styles.month}>{calendar.monthName}</Text>
        </View>
        <View style={styles.calendar}>
          {calendar.cells.map((cell, index) => (
            <View key={cell?.key ?? `blank-${index}`} style={styles.calendarCell}>
              {cell && (
                <View style={[styles.dayCircle, cell.attended && styles.dayAttended]} accessibilityLabel={cell.attended ? `${cell.day}일 출석` : undefined}>
                  <Text style={[styles.dayText, cell.attended && styles.dayTextAttended]}>{cell.day}</Text>
                </View>
              )}
            </View>
          ))}
        </View>
        <Divider />

        {dashboard.summary && (
          <>
            <Sticker label="한줄 요약" color={tone.summary} />
            <Text style={styles.summaryText}>“{dashboard.summary}”</Text>
            <Divider />
          </>
        )}

        <View style={styles.sectionHeader}>
          <Sticker label="사용 시간" color={tone.usage} />
          {/* ponytail: 샘플 분석 결과가 한 주뿐이라 주 이동은 비활성. 주별 결과가 붙으면 연결 */}
          <View style={styles.weekNav}>
            <Text style={styles.weekArrow}>‹</Text>
            <Text style={styles.period}>{dashboard.periodLabel}</Text>
            <Text style={styles.weekArrow}>›</Text>
          </View>
        </View>
        <View style={styles.legendRow}>
          <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: tone.previous }]} /><Text style={styles.legendText}>지난주 사용 시간</Text></View>
          <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: tone.current }]} /><Text style={styles.legendText}>이번주 사용 시간</Text></View>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.total}>{dashboard.totalLabel}</Text>
          <Text style={[styles.delta, dashboard.improved ? styles.goodText : styles.badText]}>{dashboard.deltaLabel}</Text>
        </View>
        <WeeklyChart
          width={chartWidth}
          current={dashboard.currentDays.map(day => day.minutes)}
          previous={dashboard.previousDays.map(day => day.minutes)}
          labels={dashboard.currentDays.map(day => day.label)}
        />
        <Divider />

        <Text style={styles.appsTitle}>앱별 사용 시간</Text>
        {dashboard.apps.map((app, index) => (
          <View key={app.packageName} style={[styles.appRow, index < dashboard.apps.length - 1 && styles.appDivider]}>
            <View style={[styles.appIcon, { backgroundColor: app.color }]}><Text style={styles.appInitial}>{app.initial}</Text></View>
            <View style={styles.appNameWrap}>
              <Text style={styles.appName}>{app.name}</Text>
              <Text style={styles.appUsage}>{app.usageLabel}</Text>
            </View>
            <Text style={[styles.appDelta, app.improved ? styles.goodText : styles.badText]}>{app.deltaLabel}</Text>
          </View>
        ))}
        <Text style={styles.sourceNote}>샘플 사용 기록을 실제 분석 코드로 계산한 결과입니다.</Text>
      </ScrollView>
    </View>
  );
}

// 브랜드 폰트는 Regular 한 종류뿐이라 fontWeight 를 주면 시스템 폰트로 떨어집니다. 굵기 대신 크기·색으로 구분합니다.
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: petoxColors.white },
  content: { paddingHorizontal: petoxLayout.screenPadding, paddingTop: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 24 },
  back: { fontSize: 34, lineHeight: 38, color: petoxColors.text },
  title: { ...petoxTextBase, fontSize: 28, color: petoxColors.text },
  sticker: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6 },
  stickerText: { ...petoxTextBase, fontSize: 15, color: petoxColors.black },
  divider: { height: 1, backgroundColor: tone.divider, marginVertical: 22 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  missionCard: { marginTop: 16, padding: 20, borderRadius: 16, backgroundColor: petoxColors.white, borderWidth: 1, borderColor: tone.divider, shadowColor: petoxColors.black, shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  missionLabel: { ...petoxTextBase, fontSize: 15, color: petoxColors.text },
  missionText: { ...petoxTextBase, fontSize: 15, color: tone.missionText, marginTop: 14 },
  progressTrack: { height: 7, borderRadius: 4, backgroundColor: petoxColors.black, marginTop: 16, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: tone.mission },
  missionCaption: { ...petoxTextBase, fontSize: 12, color: petoxColors.hint, marginTop: 8, textAlign: 'right' },
  month: { ...petoxTextBase, fontSize: 16, color: petoxColors.hint },
  calendar: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 },
  calendarCell: { width: `${100 / 7}%`, height: 36, alignItems: 'center', justifyContent: 'center' },
  dayCircle: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  dayAttended: { backgroundColor: tone.attendance, borderRadius: 16, overflow: 'hidden' },
  dayText: { ...petoxTextBase, fontSize: 16, color: '#BDBDBD' },
  dayTextAttended: { color: petoxColors.white },
  summaryText: { ...petoxTextBase, fontSize: 15, lineHeight: 24, color: '#555555', textAlign: 'center', marginTop: 18, paddingHorizontal: 8 },
  weekNav: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  weekArrow: { fontSize: 24, lineHeight: 26, color: '#CCCCCC' },
  period: { ...petoxTextBase, fontSize: 15, color: petoxColors.text },
  legendRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 22 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { ...petoxTextBase, fontSize: 15, color: petoxColors.text },
  totalRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginTop: 18, marginBottom: 6 },
  total: { ...petoxTextBase, fontSize: 26, color: petoxColors.text },
  delta: { ...petoxTextBase, fontSize: 14 },
  goodText: { color: petoxColors.greenDark },
  badText: { color: colors.heart },
  appsTitle: { ...petoxTextBase, fontSize: 17, color: petoxColors.text, marginBottom: 4 },
  appRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center' },
  appDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: petoxColors.line },
  appIcon: { width: 40, height: 40, borderRadius: petoxLayout.buttonRadius, alignItems: 'center', justifyContent: 'center' },
  appInitial: { ...petoxTextBase, color: petoxColors.white, fontSize: 18 },
  appNameWrap: { flex: 1, marginLeft: 12 },
  appName: { ...petoxTextBase, color: petoxColors.text, fontSize: 16 },
  appUsage: { ...petoxTextBase, color: petoxColors.hint, fontSize: 13, marginTop: 3 },
  appDelta: { ...petoxTextBase, fontSize: 14 },
  sourceNote: { ...petoxTextBase, textAlign: 'center', color: petoxColors.hint, fontSize: 11, marginTop: 22 },
});
