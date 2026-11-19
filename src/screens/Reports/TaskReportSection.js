import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import { Dialog, DialogButton } from '../../components/ui/Dialog';
import { reportsAPI } from '../../services/reports';
import { checkPercent, percentText, reportPeople, reportStatusTitle, scaleText } from '../../utils/reports';
import { formatQuantity, formatReadiness, isOfflineError } from '../../utils/tasks';
import { getUserFacingError } from '../../utils/userFacingError';

/**
 * Отчёт и шкалы в карточке задания (п. 8.4): статус отчёта с переходом в него; процент задания и выполнение позиций;
 * готовность объекта с историей и прямым изменением по праву 15 (только при связи, с причиной)
 */
export const TaskReportSection = ({ s, theme, task, report, progress, online, canCreate, onOpenReport, onOpenHistory, onReadinessChanged }) => {
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  // Нет отчёта — открыть, чтобы создать, может только владелец права «Заявлять отчёт» (П-ФК-10)
  const canOpen = !!report || canCreate;
  const people = reportPeople(report);

  const saveReadiness = async () => {
    const percent = checkPercent(editing.percent);
    if (percent.error || percent.value === null) {
      Toast.show({ type: 'error', text1: percent.error || 'Укажите готовность', position: 'top' });
      return;
    }
    if (!editing.reason.trim()) {
      Toast.show({ type: 'error', text1: 'Укажите причину', position: 'top' });
      return;
    }
    setBusy(true);
    try {
      const data = await reportsAPI.readiness(task.id, { percent: percent.value, shown: progress?.readiness ?? null, reason: editing.reason });
      setEditing(null);
      onReadinessChanged(data.readiness);
      Toast.show({ type: 'success', text1: 'Готовность изменена', position: 'top' });
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Готовность не изменена', text2: isOfflineError(error) ? 'Нет связи' : getUserFacingError(error, 'Попробуйте ещё раз.'), position: 'top' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Text style={s.sectionTitle}>Отчёт</Text>
      <View style={[s.card, s.cardNoGap]}>
        <Pressable
          style={({ pressed }) => [s.row, pressed && canOpen && { backgroundColor: theme.surfacePressed }]}
          onPress={canOpen ? onOpenReport : undefined}
          disabled={!canOpen}
          accessibilityRole="button"
        >
          <View style={[s.rowIcon, { backgroundColor: { approved: theme.success, submitted: theme.accent, rejected: theme.danger }[report?.status] || '#8A5BB0' }]}>
            <Ionicons name="document-text" size={16} color="#FFFFFF" />
          </View>
          <View style={s.rowBody}>
            <Text style={s.rowTitle}>{reportStatusTitle(report?.status)}</Text>
            {people.slice(-2).map((line) => <Text key={line} style={s.rowSub}>{line}</Text>)}
          </View>
          {canOpen ? <Ionicons name="chevron-forward" size={18} color={theme.textMuted} /> : null}
        </Pressable>
      </View>

      {progress ? (
        <>
          <Text style={s.sectionTitle}>Выполнение</Text>
          <View style={[s.card, s.cardNoGap]}>
            <Scale
              s={s}
              theme={theme}
              title="Задание"
              value={progress.task_percent}
              text={scaleText(progress.task_percent, progress.task_percent_approved || !report)}
            />
            {(progress.works || []).map((work) => {
              const name = (task.works || []).find((w) => Number(w.work_type_id) === Number(work.work_type_id));
              return (
                <View key={work.work_type_id} style={[s.row, s.rowBorder]}>
                  <Text style={[s.rowSub, local.flex]}>{name?.name || 'Вид работ'}</Text>
                  <Text style={s.rowSub}>{`${formatQuantity(work.done ?? 0, null)} из ${formatQuantity(work.quantity, name?.unit)}${work.approved ? '' : ' · предварительно'}`}</Text>
                </View>
              );
            })}
            <Pressable style={({ pressed }) => pressed && { backgroundColor: theme.surfacePressed }} onPress={onOpenHistory} accessibilityLabel="История объекта">
              <Scale
                s={s}
                theme={theme}
                border
                title="Объект"
                value={progress.readiness ?? 0}
                text={progress.readiness === null || progress.readiness === undefined ? 'Не задана' : formatReadiness(progress.readiness)}
                sub={progress.readiness_declared !== null && progress.readiness_declared !== undefined ? `${formatReadiness(progress.readiness_declared)} · предварительно` : null}
                chevron
              />
            </Pressable>
            {progress.readiness_edit && online ? (
              <Pressable
                style={({ pressed }) => [s.row, s.rowBorder, pressed && { backgroundColor: theme.surfacePressed }]}
                onPress={() => setEditing({ percent: percentText(progress.readiness), reason: '' })}
              >
                <Ionicons name="speedometer-outline" size={22} color={theme.accent} style={s.actionIcon} />
                <Text style={[s.rowTitle, { color: theme.accentText }]}>Изменить готовность</Text>
              </Pressable>
            ) : null}
          </View>
        </>
      ) : null}

      <Dialog
        visible={!!editing}
        keyboard
        onClose={() => setEditing(null)}
        title="Готовность объекта"
        buttons={(
          <>
            <DialogButton title="Отмена" onPress={() => setEditing(null)} />
            <DialogButton title="Сохранить" variant="primary" onPress={saveReadiness} loading={busy} />
          </>
        )}
      >
        <View style={local.inputRow}>
          <TextInput
            style={[local.input, local.percent, { backgroundColor: theme.inputBackground, color: theme.text }]}
            value={editing?.percent || ''}
            onChangeText={(percent) => setEditing((e) => ({ ...e, percent }))}
            keyboardType="decimal-pad"
            accessibilityLabel="Готовность объекта, %"
          />
          <Text style={[s.rowTitle, { color: theme.textSecondary }]}>%</Text>
        </View>
        <TextInput
          style={[local.input, local.reason, { backgroundColor: theme.inputBackground, color: theme.text }]}
          value={editing?.reason || ''}
          onChangeText={(reason) => setEditing((e) => ({ ...e, reason }))}
          placeholder="Причина"
          placeholderTextColor={theme.textMuted}
          multiline
        />
      </Dialog>
    </>
  );
};

/** Шкала: подпись, процент и полоса (как полоса в опросе переписки) */
const Scale = ({ s, theme, title, value, text, sub, border, chevron }) => (
  <View style={[local.scale, border && s.rowBorder]}>
    <View style={local.scaleHead}>
      <Text style={[s.rowTitle, local.flex]}>{title}</Text>
      <Text style={s.quantity}>{text}</Text>
      {chevron ? <Ionicons name="chevron-forward" size={18} color={theme.textMuted} /> : null}
    </View>
    <View style={[local.track, { backgroundColor: theme.fill }]}>
      <View style={[local.bar, { width: `${Math.max(0, Math.min(100, Number(value) || 0))}%`, backgroundColor: theme.accent }]} />
    </View>
    {sub ? <Text style={s.rowSub}>{sub}</Text> : null}
  </View>
);

const local = StyleSheet.create({
  flex: { flex: 1 },
  scale: { paddingHorizontal: 14, paddingVertical: 12, gap: 6 },
  scaleHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  track: { height: 4, borderRadius: 2, overflow: 'hidden' },
  bar: { height: 4, borderRadius: 2 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  input: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  percent: { flex: 1 },
  reason: { minHeight: 72, marginTop: 10, textAlignVertical: 'top' },
});
