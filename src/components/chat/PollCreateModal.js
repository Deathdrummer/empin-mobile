import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';

const MAX_OPTIONS = 10;

/** Новый опрос в группе: вопрос, от 2 до 10 вариантов, можно ли выбрать несколько */
export const PollCreateModal = ({ visible, onClose, onCreate }) => {
  const theme = useTheme();
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [multiple, setMultiple] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (visible) {
      setQuestion('');
      setOptions(['', '']);
      setMultiple(false);
      setSending(false);
    }
  }, [visible]);

  const filled = options.map((option) => option.trim()).filter(Boolean);
  const canCreate = question.trim().length > 0 && filled.length >= 2 && !sending;

  const setOption = (index, value) => setOptions((current) => {
    const next = current.map((item, i) => (i === index ? value : item));
    // Последнее поле заполнили — появляется следующее
    if (index === next.length - 1 && value.trim() && next.length < MAX_OPTIONS) next.push('');
    return next;
  });

  const removeOption = (index) => setOptions((current) => (current.length > 2 ? current.filter((_, i) => i !== index) : current));

  const create = async () => {
    if (!canCreate) return;
    setSending(true);
    const ok = await onCreate({ question: question.trim(), options: filled, multiple });
    setSending(false);
    if (ok) onClose();
  };

  const s = styles(theme);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={s.container} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={s.flex} behavior="padding">
          <View style={s.header}>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Text style={s.headerAction}>Отмена</Text>
            </TouchableOpacity>
            <Text style={s.title}>Новый опрос</Text>
            <TouchableOpacity onPress={create} disabled={!canCreate} hitSlop={12}>
              {sending ? <ActivityIndicator color={theme.accent} /> : (
                <Text style={[s.headerAction, s.headerActionStrong, !canCreate && { opacity: 0.4 }]}>Создать</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
            <Text style={s.label}>Вопрос</Text>
            <TextInput
              style={[s.input, s.question]}
              placeholder="Например: Кто завтра выходит на ТП-9?"
              placeholderTextColor={theme.textMuted}
              value={question}
              onChangeText={setQuestion}
              autoFocus
              multiline
              maxLength={255}
            />

            <Text style={s.label}>Варианты ответа</Text>
            <View style={s.card}>
              {options.map((option, index) => (
                <View key={index} style={[s.optionRow, index > 0 && s.optionBorder]}>
                  <TextInput
                    style={s.optionInput}
                    placeholder={index < 2 ? `Вариант ${index + 1}` : 'Добавить вариант'}
                    placeholderTextColor={theme.textMuted}
                    value={option}
                    onChangeText={(value) => setOption(index, value)}
                    maxLength={100}
                  />
                  {options.length > 2 && option ? (
                    <Pressable onPress={() => removeOption(index)} hitSlop={8} accessibilityLabel="Убрать вариант">
                      <Ionicons name="remove-circle" size={22} color={theme.danger} />
                    </Pressable>
                  ) : null}
                </View>
              ))}
            </View>
            <Text style={s.hint}>{`До ${MAX_OPTIONS} вариантов`}</Text>

            <View style={[s.card, s.switchRow]}>
              <Text style={s.switchLabel}>Можно выбрать несколько</Text>
              <Switch
                value={multiple}
                onValueChange={setMultiple}
                trackColor={{ true: theme.accent, false: theme.separator }}
                thumbColor="#FFFFFF"
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = (theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.dark ? theme.background : theme.surfaceAlt },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 12,
  },
  title: { flex: 1, fontSize: 18, fontWeight: '700', color: theme.text, textAlign: 'center' },
  headerAction: { fontSize: 16, color: theme.accent, fontWeight: '500', minWidth: 64 },
  headerActionStrong: { fontWeight: '700', textAlign: 'right' },
  content: { paddingHorizontal: 16, paddingBottom: 32 },
  label: { fontSize: 13, fontWeight: '600', color: theme.textSecondary, marginTop: 14, marginBottom: 6, marginLeft: 4 },
  input: { backgroundColor: theme.surface, borderRadius: 14, paddingHorizontal: 14, fontSize: 16, color: theme.text },
  question: { paddingTop: 12, paddingBottom: 12, minHeight: 52 },
  card: { backgroundColor: theme.surface, borderRadius: 14, overflow: 'hidden' },
  optionRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 8 },
  optionBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.separator },
  optionInput: { flex: 1, fontSize: 16, color: theme.text, paddingVertical: 13 },
  hint: { fontSize: 12, color: theme.textMuted, marginTop: 6, marginLeft: 4 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, marginTop: 18 },
  switchLabel: { fontSize: 16, color: theme.text },
});
