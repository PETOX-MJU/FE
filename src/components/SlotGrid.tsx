import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BLOCK_SLOTS } from '@/constants/onboardingStrings';
import { petoxColors, petoxTextBase } from '@/theme/petox';

// 숏폼 방지 시간대 고르기 — 추천 카드 + 직접 추가한 카드 + "직접 추가" 카드를 2열로.
// 온보딩(2단계)과 마이페이지 시간대 설정이 같이 쓴다.

type Props = {
  /** 추천 id('bedtime' 등) + 직접 고른 "HH:00~HH:00" */
  selected: string[];
  onToggle: (slot: string) => void;
  onAdd: () => void;
  /** 직접 설정한 카드를 누르면 고치기 (✕ 는 지우기) */
  onEdit: (range: string) => void;
};

type Cell =
  | { kind: 'preset'; id: string; icon: string; label: string; range: string }
  | { kind: 'custom'; range: string }
  | { kind: 'add' };

export function SlotGrid({ selected, onToggle, onAdd, onEdit }: Props) {
  const presetIds: string[] = BLOCK_SLOTS.map(s => s.id);
  const cells: Cell[] = [
    ...BLOCK_SLOTS.map(s => ({ kind: 'preset' as const, ...s })),
    ...selected
      .filter(s => !presetIds.includes(s))
      .map(range => ({ kind: 'custom' as const, range })),
    { kind: 'add' },
  ];

  // 2칸씩 줄로 나눠 그린다 (% 너비는 반올림 때문에 줄바꿈이 틀어질 수 있음)
  const rows: Cell[][] = [];
  for (let i = 0; i < cells.length; i += 2) rows.push(cells.slice(i, i + 2));

  return (
    <View style={styles.grid}>
      {rows.map((row, r) => (
        <View key={r} style={styles.row}>
          {row.map(cell => (
            <SlotCell
              key={
                cell.kind === 'preset'
                  ? cell.id
                  : cell.kind === 'custom'
                  ? cell.range
                  : 'add'
              }
              cell={cell}
              on={
                cell.kind === 'preset'
                  ? selected.includes(cell.id)
                  : cell.kind === 'custom'
              }
              onToggle={onToggle}
              onAdd={onAdd}
              onEdit={onEdit}
            />
          ))}
          {row.length === 1 && <View style={styles.cellSpace} />}
        </View>
      ))}
    </View>
  );
}

function SlotCell({
  cell,
  on,
  onToggle,
  onAdd,
  onEdit,
}: {
  cell: Cell;
  on: boolean;
  onToggle: (slot: string) => void;
  onAdd: () => void;
  onEdit: (range: string) => void;
}) {
  if (cell.kind === 'add') {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onAdd}
        style={({ pressed }) => [
          styles.cell,
          styles.addCell,
          pressed && styles.pressed,
        ]}
      >
        <Text style={styles.addText}>+ 직접 추가</Text>
      </Pressable>
    );
  }

  const isCustom = cell.kind === 'custom';
  const id = isCustom ? cell.range : cell.id;
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      accessibilityLabel={isCustom ? `${cell.range}, 누르면 수정` : cell.label}
      onPress={() => (isCustom ? onEdit(id) : onToggle(id))}
      style={({ pressed }) => [
        styles.cell,
        on && styles.cellOn,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.head}>
        <Text style={styles.icon}>{isCustom ? '⏰' : cell.icon}</Text>
        <Text style={[styles.label, on && styles.labelOn]}>
          {isCustom ? '직접 설정' : cell.label}
        </Text>
      </View>
      <Text style={[styles.range, on && styles.rangeOn]}>
        {isCustom ? cell.range.replace('~', ' ~ ') : cell.range}
      </Text>

      {/* 오른쪽 위: 선택 표시(✓) / 직접 설정은 ✕ 로 지우고 카드를 누르면 고친다 */}
      {isCustom ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${cell.range} 삭제`}
          hitSlop={12}
          onPress={() => onToggle(id)}
          style={styles.badge}
        >
          <Text style={styles.badgeText}>✕</Text>
        </Pressable>
      ) : (
        on && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>✓</Text>
          </View>
        )
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grid: { gap: 12 },
  row: { flexDirection: 'row', gap: 12 },
  // 빈칸도 카드와 같은 테두리·안쪽 여백을 줘야 두 칸 너비가 같아진다
  // (flex 는 남는 공간만 나누고 여백·테두리는 따로 더하기 때문)
  cellSpace: {
    flex: 1,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  cell: {
    flex: 1,
    height: 78,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#DDE8DC',
    backgroundColor: petoxColors.white,
  },
  cellOn: {
    borderColor: petoxColors.green,
    backgroundColor: petoxColors.green,
  },
  pressed: { opacity: 0.75 },
  head: { flexDirection: 'row', alignItems: 'center' },
  icon: { fontSize: 16, marginRight: 6 },
  // 브랜드 폰트는 Regular 한 종류뿐이라 fontWeight 대신 색으로 구분
  label: { ...petoxTextBase, fontSize: 14, color: petoxColors.text },
  labelOn: { color: petoxColors.white },
  range: {
    ...petoxTextBase,
    marginTop: 6,
    fontSize: 12,
    color: petoxColors.greenDark,
  },
  rangeOn: { color: '#F1FAF0' },
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: petoxColors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 11, color: petoxColors.greenDark },
  addCell: {
    alignItems: 'center',
    borderStyle: 'dashed',
    borderColor: '#BFE0BD',
    backgroundColor: '#FAFDF9',
  },
  addText: { ...petoxTextBase, fontSize: 14, color: petoxColors.greenDark },
});
