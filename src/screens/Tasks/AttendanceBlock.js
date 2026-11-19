import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import { DialogButton } from '../../components/ui/Dialog';
import { submitAttendance, useAttendanceOutbox } from '../../services/attendance';
import { brigadeStatus, confirmBody, driverStatus, personMarks } from '../../utils/attendance';
import { shortName } from '../../utils/tasks';
import { getUserFacingError } from '../../utils/userFacingError';

/**
 * Блок «Выход» в карточке задания (П-ЗД-39…43): видимый состав бригады на дату, водитель задания, статусы.
 * Подтверждающий снимает лишних и нажимает «Подтвердить» (с 10:00); добавить человека нельзя
 */
export const AttendanceBlock = ({ s, theme, block, taskId, staffId, onChanged }) => {
  const outbox = useAttendanceOutbox(staffId);
  const pending = outbox.some((item) => item.kind === 'confirm' && Number(item.taskId) === Number(taskId));
  const brigade = block?.brigade;
  const driver = block?.driver;
  const confirmable = useMemo(() => (brigade?.crew || []).filter((p) => p.in_crew !== false).map((p) => p.id), [brigade]);
  const [checked, setChecked] = useState(confirmable);
  const [driverChecked, setDriverChecked] = useState(true);
  const [busy, setBusy] = useState(false);
  useEffect(() => setChecked(confirmable), [confirmable]);

  if (!block) return null;
  const canConfirm = !pending && (brigade?.can_confirm || driver?.can_confirm);
  const toggle = (id) => setChecked((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const confirm = async () => {
    setBusy(true);
    try {
      const result = await submitAttendance({ kind: 'confirm', taskId, body: confirmBody(block, checked, driverChecked), staffId });
      if (result.data?.attendance) onChanged(result.data.attendance);
      Toast.show({ type: 'success', text1: 'Подтверждено', position: 'top' });
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Не подтверждено', text2: getUserFacingError(error, 'Попробуйте ещё раз.'), position: 'top' });
    } finally {
      setBusy(false);
    }
  };

  const Check = ({ on }) => <Ionicons name={on ? 'checkbox' : 'square-outline'} size={22} color={on ? theme.accent : theme.textMuted} />;

  return (
    <>
      <Text style={s.sectionTitle}>Выход</Text>
      <View style={[s.card, s.cardNoGap]}>
        {brigade ? (
          <>
            <View style={s.row}>
              <View style={[s.rowIcon, { backgroundColor: '#1F7FA8' }]}>
                <Ionicons name="people" size={16} color="#FFFFFF" />
              </View>
              <View style={s.rowBody}>
                <Text style={s.rowTitle}>{brigade.name}</Text>
                <Text style={s.rowSub}>{pending ? 'Подтверждено' : brigadeStatus(brigade)}</Text>
                {brigade.declared_by ? <Text style={s.rowSub}>{`Заявил состав: ${shortName(brigade.declared_by.name)}`}</Text> : null}
              </View>
              {pending ? <Ionicons name="cloud-offline-outline" size={18} color={theme.textSecondary} /> : null}
            </View>
            {(brigade.crew || []).length ? brigade.crew.map((person) => {
              const selectable = brigade.can_confirm && !pending && person.in_crew !== false;
              const marks = personMarks(person);
              return (
                <Pressable
                  key={person.id}
                  style={[s.row, s.rowBorder]}
                  onPress={selectable ? () => toggle(person.id) : undefined}
                  disabled={!selectable}
                  accessibilityRole={selectable ? 'checkbox' : undefined}
                  accessibilityState={selectable ? { checked: checked.includes(person.id) } : undefined}
                >
                  {brigade.can_confirm && !pending ? <Check on={selectable && checked.includes(person.id)} /> : null}
                  <View style={s.rowBody}>
                    <Text style={[s.rowTitle, person.in_crew === false && s.muted]}>{shortName(person.name)}</Text>
                    {marks.length ? <Text style={s.rowSub}>{marks.join(', ')}</Text> : null}
                  </View>
                </Pressable>
              );
            }) : (
              <View style={[s.row, s.rowBorder]}>
                <Text style={[s.rowTitle, s.muted]}>Нет отметившихся</Text>
              </View>
            )}
          </>
        ) : null}

        {driver ? (
          <Pressable
            style={[s.row, brigade && s.rowBorder]}
            onPress={driver.can_confirm && !pending ? () => setDriverChecked((on) => !on) : undefined}
            disabled={!driver.can_confirm || pending}
          >
            {driver.can_confirm && !pending ? <Check on={driverChecked} /> : (
              <View style={[s.rowIcon, { backgroundColor: '#4E7A2B' }]}>
                <Ionicons name="car" size={16} color="#FFFFFF" />
              </View>
            )}
            <View style={s.rowBody}>
              <Text style={s.rowTitle}>{shortName(driver.name)}</Text>
              <Text style={s.rowSub}>{`Водитель · ${driverStatus(driver)}`}</Text>
              {personMarks(driver).length ? <Text style={s.rowSub}>{personMarks(driver).join(', ')}</Text> : null}
            </View>
          </Pressable>
        ) : null}

        {canConfirm || block.confirm_from ? (
          <View style={[s.row, s.rowBorder]}>
            <DialogButton
              title={block.confirm_from ? `Подтвердить с ${block.confirm_from}` : 'Подтвердить'}
              variant="primary"
              onPress={confirm}
              disabled={!canConfirm}
              loading={busy}
            />
          </View>
        ) : null}
      </View>
    </>
  );
};
