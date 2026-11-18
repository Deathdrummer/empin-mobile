import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { DialogButton } from '../../components/ui/Dialog';
import { useTheme, useThemedStyles } from '../../theme';
import { productionAPI } from '../../services/production';
import { getUserFacingError } from '../../utils/userFacingError';
import { FILTER_KEYS, plural, shortName } from '../../utils/tasks';
import { PickerSheet } from './PickerSheet';

/** Варианты фильтра — из заданий, которые сотрудник видит (сервер), по одному значению в каждой группе */
const optionsFor = (key, data) => {
  switch (key) {
    case 'object':
      return (data?.objects || []).map((o) => ({ id: o.id, title: o.title || 'Объект', meta: o.number, label: [o.number, o.title].filter(Boolean).join(' · '), search: `${o.number} ${o.title}` }));
    case 'brigade':
      return (data?.brigades || []).map((b) => ({ id: b.id, title: b.name, label: b.name }));
    case 'vehicle':
      return (data?.vehicles || []).map((v) => ({ id: v.id, title: v.name, subtitle: v.plate, label: v.name, search: `${v.name} ${v.plate || ''}` }));
    default: {
      const list = { executor: data?.executors, creator: data?.creators, driver: data?.drivers }[key] || [];
      return list.map((p) => ({ id: p.id, title: p.name, label: shortName(p.name) }));
    }
  }
};

/** Фильтры календаря (п. 6.4): объект, бригада или сотрудник-исполнитель, создатель, техника, водитель */
export const FilterSheet = ({ visible, filters, onApply, onClose }) => {
  const theme = useTheme();
  const s = useThemedStyles(makeStyles);
  const [group, setGroup] = useState('object');
  const [draft, setDraft] = useState(filters || {});
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!visible) return;
    setDraft(filters || {});
    setError(null);
    productionAPI.filterOptions().then(setData).catch((e) => setError(getUserFacingError(e, 'Не удалось загрузить варианты')));
  }, [visible, filters]);

  const selectedCount = FILTER_KEYS.filter(({ key }) => draft[key]).length;

  const sections = useMemo(() => [{
    key: group,
    title: null,
    data: optionsFor(group, data).map((option) => ({
      key: `${group}-${option.id}`,
      ...option,
      selected: Number(draft[group]?.id) === Number(option.id),
    })),
  }], [group, data, draft]);

  const toggle = (item) => {
    setDraft((current) => {
      const next = { ...current };
      if (Number(current[group]?.id) === Number(item.id)) delete next[group];
      else next[group] = { id: item.id, label: item.label };
      // Исполнитель — бригада либо сотрудник: оба сразу дают пустой календарь
      if (group === 'brigade' && next.brigade) delete next.executor;
      if (group === 'executor' && next.executor) delete next.brigade;
      return next;
    });
  };

  const header = (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipsScroll} contentContainerStyle={s.chips} keyboardShouldPersistTaps="handled">
      {FILTER_KEYS.map(({ key, label }) => {
        const active = group === key;
        return (
          <TouchableOpacity key={key} onPress={() => setGroup(key)} style={[s.chip, active && { backgroundColor: theme.text }]}>
            <Text style={[s.chipText, active && { color: theme.background, fontWeight: '600' }]}>
              {draft[key] ? `${label} ·` : label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );

  const footer = (
    <View style={s.footer}>
      <DialogButton title="Сбросить" onPress={() => setDraft({})} disabled={!selectedCount} />
      <DialogButton
        title={selectedCount ? `Показать (${selectedCount} ${plural(selectedCount, 'фильтр', 'фильтра', 'фильтров')})` : 'Показать все'}
        variant="primary"
        onPress={() => onApply(draft)}
      />
    </View>
  );

  return (
    <PickerSheet
      visible={visible}
      title="Фильтр"
      sections={sections}
      loading={!data && !error}
      emptyText={error || 'Вариантов нет'}
      header={header}
      footer={footer}
      onSelect={toggle}
      onClose={onClose}
    />
  );
};

const makeStyles = (theme) => StyleSheet.create({
  chipsScroll: { flexGrow: 0, flexShrink: 0 },
  chips: { gap: 8, paddingHorizontal: 16, paddingVertical: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: theme.inputBackground },
  chipText: { fontSize: 14, color: theme.textSecondary, fontWeight: '500' },
  footer: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 12 },
});
