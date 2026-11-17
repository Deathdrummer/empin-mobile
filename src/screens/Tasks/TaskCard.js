import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Shadow } from 'react-native-shadow-2';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useThemedStyles } from '../../theme';
import { executorSubtitle, executorTitle, formatReadiness, plural, shortName, vehicleTitle } from '../../utils/tasks';

/**
 * Плашка задания на экране дня (п. 6.4): объект, исполнитель, кратко содержание, техника и водитель.
 * Состояние отчёта и значок неподтверждённых выходов появятся с отчётами (этап 4) и выходами (этап 2).
 */
export const TaskCard = ({ task, onPress, onLongPress }) => {
  const theme = useTheme();
  const s = useThemedStyles(makeStyles);
  const { object, executor, vehicle, driver, works } = task;
  const readiness = formatReadiness(object?.readiness);
  const worksCount = works?.length || 0;

  return (
    <Shadow
      distance={6}
      startColor={theme.shadow}
      disabled={theme.dark}
      offset={[0, 1]}
      containerStyle={s.shadowContainer}
      style={s.shadow}
    >
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={350}
        style={({ pressed }) => [s.card, pressed && s.pressed]}
        accessibilityRole="button"
        accessibilityLabel={`Задание: ${object?.number || ''} ${object?.title || ''}, ${executorTitle(executor)}`}
      >
        <View style={s.objectRow}>
          <Text style={s.number}>{object?.number || '—'}</Text>
          {object?.locality ? <Text style={s.locality} numberOfLines={1}>{object.locality}</Text> : <View style={s.flex} />}
          {readiness ? (
            <View style={s.readinessBox} accessibilityLabel={`Готовность объекта ${readiness}`}>
              <Ionicons name="speedometer-outline" size={14} color={theme.textSecondary} />
              <Text style={s.readiness}>{readiness}</Text>
            </View>
          ) : null}
        </View>
        <Text style={s.title} numberOfLines={2}>{object?.title || 'Объект'}</Text>

        <View style={s.line}>
          <Ionicons name={executor?.type === 'brigade' ? 'people' : 'person'} size={16} color={theme.textSecondary} />
          <Text style={s.lineText} numberOfLines={1}>
            <Text style={s.lineStrong}>{executor?.type === 'staff' ? shortName(executor.name) || executorTitle(executor) : executorTitle(executor)}</Text>
            {executorSubtitle(executor) ? <Text>{`  ·  ${executorSubtitle(executor)}`}</Text> : null}
          </Text>
        </View>

        {vehicle ? (
          <View style={s.line}>
            <Ionicons name="car" size={16} color={theme.textSecondary} />
            <Text style={s.lineText} numberOfLines={1}>
              {vehicleTitle(vehicle)}
              {driver?.name ? `  ·  ${shortName(driver.name)}` : '  ·  без водителя'}
            </Text>
          </View>
        ) : null}

        {task.text ? <Text style={s.text} numberOfLines={2}>{task.text}</Text> : null}

        {worksCount ? (
          <View style={s.chips}>
            <View style={s.chip}>
              <Ionicons name="list" size={13} color={theme.textSecondary} />
              <Text style={s.chipText}>{`${worksCount} ${plural(worksCount, 'вид работ', 'вида работ', 'видов работ')}`}</Text>
            </View>
          </View>
        ) : null}
      </Pressable>
    </Shadow>
  );
};

const makeStyles = (theme) => StyleSheet.create({
  shadowContainer: { marginTop: 10 },
  shadow: { width: '100%', borderRadius: 14 },
  card: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
    backgroundColor: theme.surface,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.dark ? theme.separator : theme.surface,
  },
  pressed: { backgroundColor: theme.surfacePressed },
  flex: { flex: 1 },
  objectRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  number: { fontSize: 13, fontWeight: '700', color: theme.accentText },
  locality: { flex: 1, fontSize: 13, color: theme.textMuted },
  readinessBox: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  readiness: { fontSize: 13, fontWeight: '600', color: theme.textSecondary },
  title: { fontSize: 16, fontWeight: '600', color: theme.text, lineHeight: 21 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  lineText: { flex: 1, fontSize: 14, color: theme.textSecondary },
  lineStrong: { color: theme.text, fontWeight: '600' },
  text: { fontSize: 14, lineHeight: 19, color: theme.text, marginTop: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: theme.fill,
  },
  chipText: { fontSize: 12, fontWeight: '600', color: theme.textSecondary },
});
