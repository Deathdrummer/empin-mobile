import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useFocusEffect } from '@react-navigation/native';
import ImageViewing from 'react-native-image-viewing';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { Dialog, DialogButton } from '../../components/ui/Dialog';
import { CachedImage } from '../../components/ui/CachedImage';
import { AttachmentSheet } from '../../components/chat/AttachmentSheet';
import { ViewerHeader } from '../../components/chat/ViewerHeader';
import { PickerSheet } from '../Tasks/PickerSheet';
import { emitTasksChanged, useProductionMe, useToday } from '../../services/production';
import { prepareMediaForUpload } from '../../services/mediaPrepare';
import {
  cachedReport, cancelPhoto, loadWorkTypes, queuePhoto, reportClientUuid, reportsAPI, saveReportScreen, submitReport,
  subscribeReportResult, usePendingReports,
} from '../../services/reports';
import {
  checkRow, decisionButtons, describeReportEntry, percentText, reportBody, reportMode, reportPeople, reportStatusTitle,
  rowPlanText, rowsFrom, rowWarning, scaleText, validateReport, workSections,
} from '../../utils/reports';
import { dayLabelWithDate, executorTitle, formatQuantity, formatReadiness, formatStamp, isOfflineError, shortName, vehicleTitle } from '../../utils/tasks';
import { resolveMediaUri } from '../../utils/mediaUri';
import { getUserFacingError } from '../../utils/userFacingError';

/**
 * Отчёт по заданию (п. 8.4): шапка из задания, статус и кто что сделал, позиции с планом и согласованным по объекту,
 * фото, свободное поле, проценты задания и объекта, действия по правам, история
 */
export default function ReportScreen({ navigation, route }) {
  const { task } = route.params || {};
  const taskId = task?.id;
  const theme = useTheme();
  const s = styles(theme);
  const me = useProductionMe();
  const staffId = me?.staff?.id;
  const today = useToday();
  const pending = usePendingReports(staffId, taskId);
  const pendingSave = pending.find((item) => item.kind === 'save');
  const pendingPhotos = pending.filter((item) => item.kind === 'photo');
  // Не принято сервером (П-ФК-44): заполненное остаётся на устройстве, причина — в строке статуса
  const refused = pending.find((item) => item.failed);

  const [data, setData] = useState(null);
  const [state, setState] = useState('loading');
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ text: '', taskPercent: '', objectPercent: '' });
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(null);
  const [catalog, setCatalog] = useState(null);
  const [picker, setPicker] = useState(false);
  const [attach, setAttach] = useState(false);
  const [rejecting, setRejecting] = useState(null);
  const [applyAsk, setApplyAsk] = useState(false);
  const [viewer, setViewer] = useState(null);

  const report = data?.report || null;
  const context = data?.context || {};
  const abilities = data?.abilities || {};
  const mode = reportMode(report, abilities);
  const editable = mode === 'create' || mode === 'edit' || mode === 'approve' || (mode === 'correct' && editing);
  const approving = mode === 'approve' || mode === 'correct';

  /** Поля из отчёта; неотправленное своё — поверх (без связи открывается то, что заполнили) */
  const fill = useCallback((next, queued) => {
    const nextMode = reportMode(next.report, next.abilities);
    const base = rowsFrom(next.report, task, nextMode);
    const body = queued?.body;
    const prefill = next.report ? null : next.context?.readiness;
    if (body && (nextMode === 'create' || nextMode === 'edit')) {
      const names = new Map([...base, ...(next.context?.plan || [])].map((row) => [Number(row.work_type_id), row]));
      setRows(body.items.map((item) => ({ ...(names.get(Number(item.work_type_id)) || {}), work_type_id: item.work_type_id, quantity: item.quantity === null ? '' : String(item.quantity).replace('.', ',') })));
      setForm({ text: body.text || '', taskPercent: percentText(body.task_percent), objectPercent: percentText(body.object_percent) });
      return;
    }
    setRows(base);
    const pick = (percent) => (nextMode === 'approve' || nextMode === 'correct' ? percent?.approved ?? percent?.declared : percent?.declared);
    setForm({
      text: next.report?.text || '',
      taskPercent: percentText(next.report ? pick(next.report.task_percent) : null),
      objectPercent: percentText(next.report ? pick(next.report.object_percent) : prefill),
    });
  }, [task]);

  const apply = useCallback((next, queued = null) => {
    setData(next);
    fill(next, queued);
    setEditing(false);
  }, [fill]);

  const load = useCallback(async () => {
    try {
      const next = await reportsAPI.show(taskId);
      apply(next, pendingSave);
      setState('ready');
      if (staffId) saveReportScreen(staffId, taskId, next);
    } catch (error) {
      const saved = staffId ? await cachedReport(staffId, taskId) : null;
      if (error?.response?.status === 404) {
        setState('gone');
        return;
      }
      if (saved) apply(saved, pendingSave);
      setState(saved ? 'offline' : 'failed');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId, staffId, apply]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => { loadWorkTypes().then(setCatalog); }, []);
  // Очередь отправила своё — показать ответ сервера
  useEffect(() => subscribeReportResult((item, result, error) => {
    if (Number(item.taskId) !== Number(taskId)) return;
    if (result) apply(result);
    if (error) Toast.show({ type: 'error', text1: item.kind === 'photo' ? 'Фото не принято' : 'Отчёт не принят', text2: error, position: 'top' });
  }), [taskId, apply]);

  const buttons = decisionButtons({ report, mode, abilities, rows, context });
  const offline = state === 'offline';

  const fail = (title, error) => Toast.show({
    type: 'error',
    text1: title,
    text2: isOfflineError(error) ? 'Нет связи' : getUserFacingError(error, 'Попробуйте ещё раз.'),
    position: 'top',
  });

  const body = () => reportBody(rows, form);

  // ---- Автор: сохранить, отправить (без связи — уйдёт при появлении связи) ----

  const saveAuthor = async (submit) => {
    const problem = validateReport(rows, form, submit);
    if (problem) {
      Toast.show({ type: 'error', text1: problem, position: 'top' });
      return;
    }
    setBusy(submit ? 'submit' : 'save');
    try {
      const extra = report ? {} : { object_percent_prefilled: context.readiness ?? null };
      const result = await submitReport({
        staffId, taskId, date: task?.date, body: { ...body(), ...extra, submit }, clientUuid: await reportClientUuid(staffId, taskId),
      });
      if (result.data) {
        apply(result.data);
        emitTasksChanged([task?.date]);
        const notSent = (result.data.warnings || []).find((w) => w.code === 'not_submitted');
        if (notSent) Toast.show({ type: 'error', text1: 'Отчёт не отправлен', text2: notSent.message, position: 'top' });
        else Toast.show({ type: 'success', text1: submit ? 'Отчёт отправлен' : 'Отчёт сохранён', position: 'top' });
      } else {
        Toast.show({ type: 'success', text1: submit ? 'Отчёт отправлен' : 'Отчёт сохранён', text2: 'Нет связи', position: 'top' });
      }
    } catch (error) {
      fail(submit ? 'Отчёт не отправлен' : 'Отчёт не сохранён', error);
    } finally {
      setBusy(null);
    }
  };

  // ---- Согласующий: согласовать одним действием, отклонить; правка согласованного (только при связи) ----

  const decide = async (kind, extra = {}) => {
    const problem = kind === 'reject' ? null : validateReport(rows, form, true);
    if (problem) {
      Toast.show({ type: 'error', text1: problem, position: 'top' });
      return;
    }
    setBusy(kind);
    try {
      let result;
      if (kind === 'reject') result = await reportsAPI.reject(taskId, { revision: report.revision, comment: extra.comment || null });
      else if (kind === 'correct') result = await reportsAPI.correct(taskId, { revision: report.revision, ...body(), apply_object_percent: !!extra.apply });
      else if (report) result = await reportsAPI.approve(taskId, { revision: report.revision, ...body() });
      else {
        // Создатель с правом 8 заполняет и согласует сам: сначала отчёт, затем решение
        const created = await reportsAPI.save(taskId, { ...body(), object_percent_prefilled: context.readiness ?? null, client_uuid: await reportClientUuid(staffId, taskId) });
        result = await reportsAPI.approve(taskId, { revision: created.report.revision, ...body() });
      }
      apply(result);
      saveReportScreen(staffId, taskId, result);
      emitTasksChanged([task?.date]);
      setRejecting(null);
      Toast.show({ type: 'success', text1: { reject: 'Отчёт отклонён', correct: 'Отчёт изменён' }[kind] || 'Отчёт согласован', position: 'top' });
    } catch (error) {
      if (error?.response?.data?.reason === 'report_changed' || error?.response?.data?.reason === 'report_approved') load();
      fail({ reject: 'Отчёт не отклонён', correct: 'Отчёт не изменён' }[kind] || 'Отчёт не согласован', error);
    } finally {
      setBusy(null);
    }
  };

  // Правка согласованного: процент объекта изменили — спросить, применять ли его как актуальный (П-ФК-33)
  const saveCorrection = () => {
    const before = report?.object_percent?.approved ?? null;
    const now = body().object_percent;
    if (now !== null && now !== before) setApplyAsk(true);
    else decide('correct');
  };

  // ---- Позиции и фото ----

  const setQuantity = (id, quantity) => setRows((list) => list.map((row) => (Number(row.work_type_id) === Number(id) ? { ...row, quantity } : row)));
  const removeRow = (id) => setRows((list) => list.filter((row) => Number(row.work_type_id) !== Number(id)));
  const addRow = (item) => {
    setPicker(false);
    setRows((list) => [...list, { ...item.work, declared: null, approved: null, quantity: '' }]);
  };
  const sections = useMemo(
    () => workSections(context, catalog, rows, approving ? abilities.approve_off_plan : abilities.declare_off_plan),
    [context, catalog, rows, approving, abilities],
  );

  const canPhotos = !offline && (mode === 'create' || mode === 'edit' || mode === 'approve' || (mode === 'correct' && editing))
    || (offline && (mode === 'create' || mode === 'edit'));

  const addPhotos = async (assets) => {
    try {
      // Отчёта на сервере ещё нет — сначала черновик, фото прикрепляется к нему (без связи — по порядку в очереди)
      if (!report && !pendingSave) {
        const created = await submitReport({
          staffId, taskId, date: task?.date, body: { ...body(), object_percent_prefilled: context.readiness ?? null, submit: false },
          clientUuid: await reportClientUuid(staffId, taskId),
        });
        if (created.data) apply(created.data);
      }
      const prepared = await prepareMediaForUpload(assets);
      for (const asset of prepared) {
        await queuePhoto({ staffId, taskId, date: task?.date, asset });
      }
    } catch (error) {
      fail('Фото не добавлено', error);
    }
  };

  const photos = [
    ...(report?.photos || []).map((photo) => ({ key: `s${photo.id}`, id: photo.id, uri: resolveMediaUri(photo.url) })),
    ...pendingPhotos.map((item) => ({ key: item.uuid, uuid: item.uuid, uri: item.file.uri, pending: true, failed: !!item.failed })),
  ];

  const removePhoto = async (photo) => {
    setViewer(null);
    if (photo.pending) {
      cancelPhoto(photo.uuid);
      return;
    }
    setBusy('photo');
    try {
      apply(await reportsAPI.removePhoto(taskId, photo.id));
    } catch (error) {
      fail('Фото не удалено', error);
    } finally {
      setBusy(null);
    }
  };

  // ---- Отрисовка ----

  const topBar = (
    <View style={s.topBar}>
      <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={s.back} accessibilityLabel="Назад">
        <Ionicons name="chevron-back" size={28} color={theme.accent} />
      </Pressable>
      <Text style={s.topTitle}>Отчёт</Text>
      <View style={s.back}>{busy ? <ActivityIndicator color={theme.accent} /> : null}</View>
    </View>
  );

  if (!data) {
    return (
      <SafeAreaView style={s.container} edges={['top']}>
        {topBar}
        {state === 'loading' ? <ActivityIndicator style={s.loader} size="large" color={theme.accent} /> : (
          <View style={s.stub}>
            <Ionicons name={state === 'gone' ? 'lock-closed-outline' : 'cloud-offline-outline'} size={44} color={theme.textMuted} />
            <Text style={s.stubText}>{state === 'gone' ? 'Задание удалено или нет доступа' : 'Нет связи'}</Text>
            {state !== 'gone' ? (
              <TouchableOpacity onPress={() => { setState('loading'); load(); }} style={s.heroAction}>
                <Text style={s.heroActionText}>Повторить</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}
      </SafeAreaView>
    );
  }

  const status = pendingSave && !pendingSave.failed ? (pendingSave.body.submit ? 'Отправлен' : reportStatusTitle(report?.status || 'draft')) : reportStatusTitle(report?.status);
  const people = reportPeople(report);
  const objectNow = context.readiness ?? null;
  const prefilled = report?.object_percent?.prefilled ?? null;
  const showNow = !!report && approving && objectNow !== prefilled;

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      {topBar}
      <KeyboardAwareScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" bottomOffset={24}>
        {offline ? (
          <View style={s.notice}>
            <Ionicons name="cloud-offline-outline" size={18} color={theme.textSecondary} />
            <Text style={s.noticeText}>Нет связи — показана сохранённая версия</Text>
          </View>
        ) : null}

        <View style={s.hero}>
          {task?.object?.number ? <Text style={s.heroNumber}>{task.object.number}</Text> : null}
          <Text style={s.heroTitle}>{task?.object?.title || 'Объект'}</Text>
          <Text style={s.heroSub}>{`${dayLabelWithDate(task?.date, today)} · ${executorTitle(task?.executor)}`}</Text>
          {task?.vehicle ? <Text style={s.heroSub}>{`${vehicleTitle(task.vehicle)}${task.driver?.name ? ` · ${shortName(task.driver.name)}` : ''}`}</Text> : null}
        </View>

        <View style={[s.card, s.cardNoGap]}>
          <View style={s.row}>
            <View style={[s.rowIcon, { backgroundColor: statusColor(theme, report?.status) }]}>
              <Ionicons name="document-text" size={16} color="#FFFFFF" />
            </View>
            <View style={s.rowBody}>
              <Text style={s.rowTitle}>{status}</Text>
              {people.map((line) => <Text key={line} style={s.rowSub}>{line}</Text>)}
              {report?.status === 'rejected' && report.reject_comment ? <Text style={s.rowSub}>{`Причина: ${report.reject_comment}`}</Text> : null}
              {refused ? <Text style={[s.rowSub, { color: theme.danger }]}>{`Не принято: ${refused.failed}`}</Text> : null}
            </View>
            {refused ? <Ionicons name="alert-circle" size={18} color={theme.danger} />
              : pendingSave || pendingPhotos.length ? <Ionicons name="cloud-offline-outline" size={18} color={theme.textSecondary} /> : null}
          </View>
        </View>

        {/* Водитель не отметил выход — предупреждение согласующему (П-ФК-18) */}
        {mode === 'approve' ? (context.warnings || []).map((warning) => (
          <View key={warning.code} style={s.warning}>
            <Ionicons name="warning" size={18} color={theme.accentText} />
            <Text style={s.warningText}>{warning.message}</Text>
          </View>
        )) : null}

        <Text style={s.sectionTitle}>Виды работ</Text>
        <View style={[s.card, s.cardNoGap]}>
          {rows.length ? rows.map((row, index) => {
            const check = checkRow(row, context, abilities, approving);
            const warning = rowWarning(check);
            return (
              <View key={row.work_type_id} style={[s.workRow, index > 0 && s.rowBorder]}>
                <View style={s.workHead}>
                  <Text style={[s.rowTitle, s.flex]}>{row.name || 'Вид работ'}</Text>
                  {editable ? (
                    <>
                      <TextInput
                        style={[s.quantityInput, check.invalid && s.inputError]}
                        value={row.quantity}
                        onChangeText={(text) => setQuantity(row.work_type_id, text)}
                        keyboardType="decimal-pad"
                        accessibilityLabel={`Количество: ${row.name}`}
                      />
                      <Text style={s.unit}>{row.unit}</Text>
                      <TouchableOpacity onPress={() => removeRow(row.work_type_id)} hitSlop={8} accessibilityLabel={`Убрать: ${row.name}`}>
                        <Ionicons name="remove-circle" size={22} color={theme.danger} />
                      </TouchableOpacity>
                    </>
                  ) : (
                    <Text style={s.quantity}>{formatQuantity(report?.status === 'approved' ? row.approved : row.declared, row.unit)}</Text>
                  )}
                </View>
                {approving && row.declared !== null && row.declared !== undefined ? <Text style={s.rowSub}>{`Заявлено: ${formatQuantity(row.declared, row.unit)}`}</Text> : null}
                <Text style={s.rowSub}>{rowPlanText(row, check, report?.status === 'approved' && !editing ? row.approved : 0)}</Text>
                {warning && editable ? <Text style={[s.rowSub, { color: check.blocked ? theme.danger : theme.accentText }]}>{warning}</Text> : null}
                {row.edited_by ? <Text style={s.rowSub}>{`Изменено: ${shortName(row.edited_by.name)}, ${formatStamp(row.edited_at)}`}</Text> : null}
              </View>
            );
          }) : (
            <View style={s.row}><Text style={[s.rowTitle, s.muted]}>Нет видов работ</Text></View>
          )}
          {editable ? (
            <Pressable style={({ pressed }) => [s.row, s.rowBorder, pressed && { backgroundColor: theme.surfacePressed }]} onPress={() => setPicker(true)}>
              <View style={[s.rowIcon, { backgroundColor: theme.accentSoft }]}>
                <Ionicons name="add" size={18} color={theme.accentText} />
              </View>
              <Text style={[s.rowTitle, { color: theme.accentText }]}>Добавить вид работ</Text>
            </Pressable>
          ) : null}
        </View>

        <Text style={s.sectionTitle}>Фото</Text>
        <View style={[s.card, s.cardNoGap, s.photos]}>
          {photos.map((photo, index) => (
            <Pressable key={photo.key} onPress={() => setViewer(index)} style={s.photo} accessibilityLabel={`Фото ${index + 1}`}>
              <CachedImage uri={photo.uri} style={s.photoImage} />
              {photo.pending ? (
                <View style={[s.photoBadge, photo.failed && { backgroundColor: theme.danger }]}>
                  <Ionicons name={photo.failed ? 'alert-circle' : 'cloud-offline-outline'} size={14} color="#FFFFFF" />
                </View>
              ) : null}
            </Pressable>
          ))}
          {canPhotos ? (
            <Pressable style={[s.photo, s.photoAdd]} onPress={() => setAttach(true)} accessibilityLabel="Добавить фото">
              <Ionicons name="camera" size={26} color={theme.accentText} />
            </Pressable>
          ) : null}
          {!photos.length && !canPhotos ? <Text style={[s.rowTitle, s.muted, s.photosEmpty]}>Нет фото</Text> : null}
        </View>

        <Text style={s.sectionTitle}>Пояснение</Text>
        <View style={[s.card, s.cardNoGap]}>
          {editable ? (
            <TextInput
              style={s.textInput}
              value={form.text}
              onChangeText={(text) => setForm((f) => ({ ...f, text }))}
              multiline
              accessibilityLabel="Пояснение"
            />
          ) : (
            <Text style={[s.taskText, !report?.text && s.muted]}>{report?.text || 'Нет'}</Text>
          )}
        </View>

        <Text style={s.sectionTitle}>Проценты</Text>
        <View style={[s.card, s.cardNoGap]}>
          <PercentRow
            s={s}
            title="Выполнение задания"
            editable={editable}
            value={form.taskPercent}
            onChange={(taskPercent) => setForm((f) => ({ ...f, taskPercent }))}
            shown={shownPercent(report, 'task_percent', editable, approving)}
          />
          <PercentRow
            s={s}
            border
            title="Готовность объекта"
            editable={editable}
            value={form.objectPercent}
            onChange={(objectPercent) => setForm((f) => ({ ...f, objectPercent }))}
            shown={shownPercent(report, 'object_percent', editable, approving)}
            hint={showNow ? `Готовность объекта сейчас: ${formatReadiness(objectNow) || 'не задана'}` : null}
          />
        </View>

        {!offline || mode === 'create' || mode === 'edit' ? (
          <View style={s.actions}>
            {buttons.reject ? <DialogButton title="Отклонить" variant="danger" onPress={() => setRejecting({ comment: '' })} loading={busy === 'reject'} disabled={!!busy || offline} /> : null}
            {buttons.save ? <DialogButton title="Сохранить" onPress={() => saveAuthor(false)} loading={busy === 'save'} disabled={!!busy} /> : null}
            {buttons.submit ? <DialogButton title="Отправить" variant="primary" onPress={() => saveAuthor(true)} loading={busy === 'submit'} disabled={!!busy || buttons.submitBlocked} /> : null}
            {buttons.approve ? <DialogButton title="Согласовать" variant="success" onPress={() => decide('approve')} loading={busy === 'approve'} disabled={!!busy || offline || buttons.approveBlocked} /> : null}
            {mode === 'correct' && !editing && !offline ? <DialogButton title="Изменить" onPress={() => setEditing(true)} /> : null}
            {mode === 'correct' && editing ? (
              <>
                <DialogButton title="Отмена" onPress={() => apply(data)} disabled={!!busy} />
                <DialogButton title="Сохранить" variant="primary" onPress={saveCorrection} loading={busy === 'correct'} disabled={!!busy || offline} />
              </>
            ) : null}
          </View>
        ) : null}

        {report?.history?.length ? (
          <>
            <Text style={s.sectionTitle}>История</Text>
            <View style={[s.card, s.cardNoGap]}>
              {report.history.map((entry, index) => {
                const item = describeReportEntry(entry);
                return (
                  <View key={entry.id} style={[s.historyRow, index > 0 && s.rowBorder]}>
                    <Text style={s.rowTitle}>{item.title}</Text>
                    {item.details.map((line) => <Text key={line} style={s.historyDetail}>{line}</Text>)}
                    <Text style={s.rowSub}>{`${item.actor}, ${formatStamp(entry.at)}`}</Text>
                  </View>
                );
              })}
            </View>
          </>
        ) : null}
      </KeyboardAwareScrollView>

      <PickerSheet
        visible={picker}
        title="Вид работ"
        sections={sections}
        loading={picker && !catalog}
        searchPlaceholder="Название"
        emptyText="Нет видов работ"
        onSelect={addRow}
        onClose={() => setPicker(false)}
      />

      <AttachmentSheet visible={attach} theme={theme} photosOnly onClose={() => setAttach(false)} onPicked={addPhotos} />

      <ImageViewing
        images={photos.map((photo) => ({ uri: photo.uri }))}
        imageIndex={viewer ?? 0}
        visible={viewer !== null}
        onRequestClose={() => setViewer(null)}
        swipeToCloseEnabled
        doubleTapToZoomEnabled
        HeaderComponent={({ imageIndex }) => (
          <ViewerHeader
            title={photos.length > 1 ? `${imageIndex + 1} из ${photos.length}` : ''}
            onClose={() => setViewer(null)}
            actions={canPhotos && !offline ? [{ key: 'delete', icon: 'trash-outline', label: 'Удалить фото', onPress: () => removePhoto(photos[imageIndex]) }] : []}
          />
        )}
      />

      <Dialog
        visible={!!rejecting}
        keyboard
        onClose={() => setRejecting(null)}
        title="Отклонить отчёт?"
        buttons={(
          <>
            <DialogButton title="Отмена" onPress={() => setRejecting(null)} />
            <DialogButton title="Отклонить" variant="danger" onPress={() => decide('reject', rejecting)} loading={busy === 'reject'} />
          </>
        )}
      >
        <TextInput
          style={s.dialogInput}
          value={rejecting?.comment || ''}
          onChangeText={(comment) => setRejecting({ comment })}
          placeholder="Причина"
          placeholderTextColor={theme.textMuted}
          multiline
        />
      </Dialog>

      <Dialog
        visible={applyAsk}
        onClose={() => setApplyAsk(false)}
        title="Применить исправленный процент как актуальный?"
        message={`Готовность объекта: ${formatReadiness(body().object_percent)}`}
        buttons={(
          <>
            <DialogButton title="Нет" onPress={() => { setApplyAsk(false); decide('correct', { apply: false }); }} />
            <DialogButton title="Применить" variant="primary" onPress={() => { setApplyAsk(false); decide('correct', { apply: true }); }} />
          </>
        )}
      />
    </SafeAreaView>
  );
}

/** Процент под полем: при просмотре — значение (предварительное до согласования), согласующему — заявленное */
const shownPercent = (report, key, editable, approving) => {
  if (!report) return null;
  const percent = report[key] || {};
  if (editable) return approving && percent.declared !== null && percent.declared !== undefined ? `Заявлено: ${formatReadiness(percent.declared)}` : null;
  const approved = report.status === 'approved';
  const value = approved ? percent.approved : percent.declared;
  return value === null || value === undefined ? null : scaleText(value, approved);
};

const statusColor = (theme, status) => ({ approved: theme.success, submitted: theme.accent, rejected: theme.danger }[status] || theme.textMuted);

const PercentRow = ({ s, title, editable, value, onChange, shown, hint, border }) => (
  <View style={[s.workRow, border && s.rowBorder]}>
    <View style={s.workHead}>
      <Text style={[s.rowTitle, s.flex]}>{title}</Text>
      {editable ? (
        <>
          <TextInput style={s.quantityInput} value={value} onChangeText={onChange} keyboardType="decimal-pad" accessibilityLabel={title} />
          <Text style={s.unit}>%</Text>
        </>
      ) : (
        <Text style={s.quantity}>{shown || '—'}</Text>
      )}
    </View>
    {editable && shown ? <Text style={s.rowSub}>{shown}</Text> : null}
    {hint ? <Text style={s.rowSub}>{hint}</Text> : null}
  </View>
);

const styles = (theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.dark ? theme.background : theme.surfaceAlt },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 6, height: 50 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontSize: 17, fontWeight: '600', color: theme.text },
  loader: { marginTop: 80 },
  stub: { alignItems: 'center', gap: 12, paddingHorizontal: 32, marginTop: 80 },
  stubText: { fontSize: 15, color: theme.textSecondary, textAlign: 'center', lineHeight: 21 },
  heroAction: { marginTop: 4, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 14, backgroundColor: theme.accentSoft },
  heroActionText: { fontSize: 14, fontWeight: '600', color: theme.accentText },
  content: { paddingHorizontal: 16, paddingBottom: 40 },
  notice: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', padding: 12, borderRadius: 14, backgroundColor: theme.fill, marginTop: 8 },
  noticeText: { flex: 1, fontSize: 14, lineHeight: 19, color: theme.textSecondary },
  warning: { flexDirection: 'row', gap: 8, alignItems: 'center', padding: 12, borderRadius: 14, backgroundColor: theme.accentSoft, marginTop: 12 },
  warningText: { flex: 1, fontSize: 14, lineHeight: 19, color: theme.text },
  hero: { alignItems: 'center', paddingVertical: 12, gap: 4 },
  heroNumber: { fontSize: 15, fontWeight: '700', color: theme.accentText },
  heroTitle: { fontSize: 22, fontWeight: '700', color: theme.text, textAlign: 'center' },
  heroSub: { fontSize: 14, color: theme.textSecondary, textAlign: 'center' },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: theme.textSecondary, marginTop: 22, marginBottom: 8, marginLeft: 4 },
  card: { backgroundColor: theme.surface, borderRadius: 14, overflow: 'hidden', marginTop: 12 },
  cardNoGap: { marginTop: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10, minHeight: 52 },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.separator },
  rowIcon: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  rowBody: { flex: 1 },
  rowTitle: { fontSize: 16, color: theme.text },
  rowSub: { fontSize: 13, color: theme.textSecondary, marginTop: 1 },
  flex: { flex: 1 },
  muted: { color: theme.textMuted },
  quantity: { fontSize: 15, fontWeight: '600', color: theme.text },
  workRow: { paddingHorizontal: 14, paddingVertical: 10, gap: 2 },
  workHead: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 36 },
  quantityInput: {
    minWidth: 72,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: theme.inputBackground,
    fontSize: 16,
    color: theme.text,
    textAlign: 'right',
  },
  inputError: { borderWidth: 1, borderColor: theme.danger },
  unit: { fontSize: 14, color: theme.textSecondary, minWidth: 24 },
  photos: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 12 },
  photo: { width: 84, height: 84, borderRadius: 10, overflow: 'hidden', backgroundColor: theme.fill },
  photoImage: { width: '100%', height: '100%' },
  photoAdd: { alignItems: 'center', justifyContent: 'center', backgroundColor: theme.accentSoft },
  photoBadge: { position: 'absolute', right: 4, bottom: 4, borderRadius: 10, padding: 3, backgroundColor: 'rgba(0,0,0,0.55)' },
  photosEmpty: { paddingVertical: 4 },
  textInput: { minHeight: 88, fontSize: 16, lineHeight: 22, color: theme.text, padding: 14, textAlignVertical: 'top' },
  taskText: { fontSize: 16, lineHeight: 22, color: theme.text, padding: 14 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 22 },
  historyRow: { paddingHorizontal: 14, paddingVertical: 10, gap: 2 },
  historyDetail: { fontSize: 14, color: theme.text },
  dialogInput: {
    minHeight: 72,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: theme.inputBackground,
    fontSize: 16,
    color: theme.text,
    textAlignVertical: 'top',
  },
});
