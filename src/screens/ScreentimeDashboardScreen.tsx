import React, { useEffect, useMemo, useState } from 'react';
import {
  AppState,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Svg, { Defs, LinearGradient, Line, Path, Polygon, Stop, Text as SvgText } from 'react-native-svg';
import { supabase } from '@/api/supabase';
import {
  localDateKey,
  monthCalendar,
  toDashboardModel,
  toMissionCards,
  type DashboardModel,
  type MissionRow,
} from '@/features/screentime/dashboard';
import { loadAnalysisSettings, screentime } from '@/features/screentime/onDevice';
import type { RootStackParamList } from '@/navigation/RootNavigator';
import { colors } from '@/theme/colors';
import { petoxColors, petoxFont, petoxLayout, petoxTextBase } from '@/theme/petox';

type Props = NativeStackScreenProps<RootStackParamList, 'ScreentimeDashboard'>;

// Figma 대시보드 스티커·그래프 색
const tone = {
  mission: '#E4C8F9',
  attendance: '#A9DDA2',
  summary: '#F6A19B',
  usage: '#BBD8F7',
  current: '#4DB6C7',
  previous: '#F6B24E',
  divider: '#EEEEEE',
};

const MISSION_STATUS = { in_progress: '진행 중', completed: '달성', failed: '미달성' } as const;

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
const BASELINE = CHART_HEIGHT - PAD.bottom;
const xAt = (index: number, width: number) => PAD.left + ((width - PAD.left - PAD.right) * index) / 6;

// 확인 불가(null) 인 날은 점을 찍지 않는다.
function smoothPath(values: Array<number | null>, width: number, maxValue: number) {
  const baseline = BASELINE;
  const points = values.flatMap((value, index) =>
    value === null ? [] : [{ x: xAt(index, width), y: baseline - (value / maxValue) * (baseline - PAD.top) }],
  );
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

type Series = Array<number | null>;

function WeeklyChart({ width, current, previous, labels }: { width: number; current: Series; previous: Series; labels: string[] }) {
  const known = [...current, ...previous].filter((value): value is number => value !== null);
  const maxValue = Math.max(...known, 1) * 1.15;
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
        const y = PAD.top + (BASELINE - PAD.top) * ratio;
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
        <SvgText key={index} x={xAt(index, width)} y={CHART_HEIGHT - 6} textAnchor="middle" fontSize="12" fontFamily={petoxFont} fill={petoxColors.hint}>
          {label}
        </SvgText>
      ))}
    </Svg>
  );
}

type ServerState =
  | { status: 'loading' | 'signedOut' | 'error' }
  | { status: 'ready'; attendance: string[]; missions: ReturnType<typeof toMissionCards> };

// 출석(attendance)·오늘의 미션(user_missions)은 BE 테이블을 RLS 로 직접 읽는다(ADR-002).
function useServerData(today: Date): ServerState {
  const [state, setState] = useState<ServerState>({ status: 'loading' });
  useEffect(() => {
    let alive = true;
    const set = (next: ServerState) => alive && setState(next);
    const monthStart = localDateKey(new Date(today.getFullYear(), today.getMonth(), 1));
    const monthEnd = localDateKey(new Date(today.getFullYear(), today.getMonth() + 1, 0));
    (async () => {
      const { data: auth } = await supabase.auth.getSession();
      if (!auth.session) return set({ status: 'signedOut' });
      const [attendance, missions] = await Promise.all([
        supabase.from('attendance').select('attended_on').gte('attended_on', monthStart).lte('attended_on', monthEnd),
        supabase
          .from('user_missions')
          .select('id, status, missions!inner(title)')
          .eq('missions.type', 'daily')
          .eq('missions.valid_date', localDateKey(today)),
      ]);
      if (attendance.error || missions.error) {
        console.warn('대시보드 서버 데이터 조회 실패', attendance.error?.message ?? missions.error?.message);
        return set({ status: 'error' });
      }
      set({
        status: 'ready',
        attendance: attendance.data.map(row => row.attended_on),
        missions: toMissionCards(missions.data as unknown as MissionRow[]),
      });
    })().catch(() => set({ status: 'error' }));
    return () => {
      alive = false;
    };
  }, [today]);
  return state;
}

type AnalysisState =
  | { status: 'loading' | 'needsPermission' | 'unsupported' | 'error' }
  | { status: 'ready'; dashboard: DashboardModel };

// 사용 기록은 폰 안에서 모아 Kotlin 분석기로 분석한다. 서버로 보내지 않는다.
function useOnDeviceAnalysis(): AnalysisState {
  const [state, setState] = useState<AnalysisState>({ status: 'loading' });
  useEffect(() => {
    let alive = true;
    const set = (next: AnalysisState) => alive && setState(next);
    const run = async () => {
      if (!screentime.available) return set({ status: 'unsupported' });
      if (!(await screentime.hasUsageAccess())) return set({ status: 'needsPermission' });
      const output = await screentime.analyze(await loadAnalysisSettings());
      set({ status: 'ready', dashboard: toDashboardModel({ analysis: output }) });
    };
    const refresh = () =>
      run().catch(error => {
        console.warn('스크린타임 분석 실패', error);
        set({ status: 'error' });
      });
    refresh();
    // 설정에서 사용 정보 접근을 허용하고 돌아오면 다시 분석한다.
    const sub = AppState.addEventListener('change', next => next === 'active' && refresh());
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return state;
}

const ANALYSIS_MESSAGE = {
  loading: '사용 기록을 분석하는 중이에요',
  needsPermission: '사용 시간을 보려면 사용 정보 접근을 허용해 주세요',
  unsupported: '이 기기에서는 사용 시간을 분석할 수 없어요',
  error: '사용 시간을 분석하지 못했어요',
} as const;

const SERVER_MESSAGE = {
  loading: '불러오는 중이에요',
  signedOut: '로그인하면 볼 수 있어요',
  error: '불러오지 못했어요',
} as const;

function AnalysisSections({ dashboard, chartWidth }: { dashboard: DashboardModel; chartWidth: number }) {
  return (
    <>
        {dashboard.summary && (
          <>
            <Sticker label="한줄 요약" color={tone.summary} />
            <Text style={styles.summaryText}>“{dashboard.summary}”</Text>
            <Divider />
          </>
        )}

        <View style={styles.sectionHeader}>
          <Sticker label="사용 시간" color={tone.usage} />
          {/* ponytail: 이번 주만 분석한다. 지난 주 이동은 이벤트 보관 기간(수일) 때문에 보류 */}
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
          <Text style={[styles.delta, TONE_STYLE[dashboard.deltaTone]]}>{dashboard.deltaLabel}</Text>
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
            <Text style={[styles.appDelta, TONE_STYLE[app.deltaTone]]}>{app.deltaLabel}</Text>
          </View>
        ))}
    </>
  );
}

export function ScreentimeDashboardScreen({ navigation }: Props) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const analysis = useOnDeviceAnalysis();
  const [today] = useState(() => new Date());
  const server = useServerData(today);
  const calendar = useMemo(() => monthCalendar(today, server.status === 'ready' ? server.attendance : []), [today, server]);
  const chartWidth = width - petoxLayout.screenPadding * 2;

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

        <Sticker label="오늘의 미션" color={tone.mission} />
        {server.status !== 'ready' ? (
          <Text style={styles.emptyText}>{SERVER_MESSAGE[server.status]}</Text>
        ) : server.missions.length === 0 ? (
          <Text style={styles.emptyText}>오늘 미션이 아직 없어요</Text>
        ) : (
          <View style={styles.missionRow}>
            {server.missions.map(mission => (
              <View
                key={mission.id}
                style={[styles.missionCard, mission.status === 'completed' && styles.missionDone]}
                accessibilityLabel={`${mission.title}, ${MISSION_STATUS[mission.status]}`}>
                <Text style={[styles.missionTitle, mission.status === 'failed' && styles.missionFailed]}>{mission.title}</Text>
              </View>
            ))}
          </View>
        )}
        <Divider />

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
        {server.status !== 'ready' && <Text style={styles.emptyText}>{SERVER_MESSAGE[server.status]}</Text>}
        <Divider />

        {analysis.status === 'ready' ? (
          <AnalysisSections dashboard={analysis.dashboard} chartWidth={chartWidth} />
        ) : (
          <View style={styles.analysisEmpty}>
            <Text style={styles.emptyText}>{ANALYSIS_MESSAGE[analysis.status]}</Text>
            {analysis.status === 'needsPermission' && (
              <Pressable style={styles.permissionButton} onPress={screentime.openUsageAccessSettings} accessibilityRole="button">
                <Text style={styles.permissionText}>사용 정보 접근 허용하기</Text>
              </Pressable>
            )}
          </View>
        )}
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
  missionRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  // Figma: 진행 중은 흰 카드+검은 테두리, 달성은 보라 채움
  missionCard: { flex: 1, minHeight: 120, borderRadius: 14, borderWidth: 1.5, borderColor: petoxColors.black, backgroundColor: petoxColors.white, alignItems: 'center', justifyContent: 'center', padding: 10 },
  missionDone: { backgroundColor: tone.mission, borderColor: tone.mission },
  missionTitle: { ...petoxTextBase, fontSize: 14, lineHeight: 20, color: petoxColors.text, textAlign: 'center' },
  missionFailed: { color: petoxColors.hint },
  emptyText: { ...petoxTextBase, fontSize: 14, color: petoxColors.hint, textAlign: 'center', marginTop: 16 },
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
  neutralText: { color: petoxColors.hint },
  appsTitle: { ...petoxTextBase, fontSize: 17, color: petoxColors.text, marginBottom: 4 },
  appRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center' },
  appDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: petoxColors.line },
  appIcon: { width: 40, height: 40, borderRadius: petoxLayout.buttonRadius, alignItems: 'center', justifyContent: 'center' },
  appInitial: { ...petoxTextBase, color: petoxColors.white, fontSize: 18 },
  appNameWrap: { flex: 1, marginLeft: 12 },
  appName: { ...petoxTextBase, color: petoxColors.text, fontSize: 16 },
  appUsage: { ...petoxTextBase, color: petoxColors.hint, fontSize: 13, marginTop: 3 },
  appDelta: { ...petoxTextBase, fontSize: 14 },
  analysisEmpty: { alignItems: 'center', paddingVertical: 12 },
  permissionButton: { marginTop: 14, height: petoxLayout.buttonHeight, paddingHorizontal: 22, borderRadius: petoxLayout.buttonRadius, backgroundColor: petoxColors.black, justifyContent: 'center' },
  permissionText: { ...petoxTextBase, fontSize: 15, color: petoxColors.white },
});

const TONE_STYLE = { good: styles.goodText, bad: styles.badText, neutral: styles.neutralText };
