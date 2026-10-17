import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { plural } from '../../utils/chatFormat';

/**
 * Опрос в группе: вопрос, варианты, полоски с процентами после голосования.
 * Повторное нажатие на свой вариант отзывает голос; в опросе с несколькими ответами варианты переключаются.
 */
export const PollCard = ({ message, myStaffId, colors, theme, onVote }) => {
  const poll = message.poll;
  if (!poll) return null;

  const options = poll.options || [];
  const mine = options
    .map((option, index) => ((option.voters || []).map(Number).includes(Number(myStaffId)) ? index : null))
    .filter((index) => index !== null);
  const voted = mine.length > 0;
  const total = poll.total_voters || 0;
  const maxVotes = Math.max(1, ...options.map((option) => (option.voters || []).length));

  const vote = (index) => {
    Haptics.selectionAsync().catch(() => {});
    let next;
    if (poll.multiple) {
      next = mine.includes(index) ? mine.filter((item) => item !== index) : [...mine, index];
    } else {
      next = mine.includes(index) ? [] : [index];
    }
    onVote(message, next);
  };

  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <Ionicons name="stats-chart" size={14} color={colors.accent} />
        <Text style={[styles.kind, { color: colors.accent }]}>{poll.multiple ? 'Опрос · несколько ответов' : 'Опрос'}</Text>
      </View>
      <Text style={[styles.question, { color: colors.text }]}>{poll.question}</Text>

      {options.map((option, index) => {
        const count = (option.voters || []).length;
        const percent = total ? Math.round((count / total) * 100) : 0;
        const selected = mine.includes(index);
        const leading = count === maxVotes && count > 0;

        return (
          <Pressable
            key={index}
            onPress={() => vote(index)}
            style={({ pressed }) => [styles.option, pressed && { opacity: 0.7 }]}
            accessibilityRole={poll.multiple ? 'checkbox' : 'radio'}
            accessibilityState={{ checked: selected }}
            accessibilityLabel={`${option.text}${voted ? `, ${percent}%` : ''}`}
          >
            <View style={styles.optionRow}>
              <View
                style={[
                  poll.multiple ? styles.checkbox : styles.radio,
                  { borderColor: selected ? colors.accent : colors.meta },
                  selected && { backgroundColor: colors.accent },
                ]}
              >
                {selected ? <Ionicons name="checkmark" size={13} color={theme.onAccent} /> : null}
              </View>
              <Text style={[styles.optionText, { color: colors.text }]}>{option.text}</Text>
              {voted ? <Text style={[styles.percent, { color: colors.text }, leading && styles.percentLeading]}>{`${percent}%`}</Text> : null}
            </View>
            {voted ? (
              <View style={[styles.track, { backgroundColor: colors.track }]}>
                <View style={[styles.bar, { width: `${Math.max(percent, count ? 4 : 0)}%`, backgroundColor: colors.accent }]} />
              </View>
            ) : null}
          </Pressable>
        );
      })}

      <Text style={[styles.footer, { color: colors.meta }]}>
        {total ? `${total} ${plural(total, 'голос', 'голоса', 'голосов')}` : 'Голосов пока нет'}
        {voted ? ' · нажмите свой ответ, чтобы отменить' : ''}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { minWidth: 230, paddingTop: 2, paddingBottom: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 3 },
  kind: { fontSize: 12, fontWeight: '600' },
  question: { fontSize: 16, fontWeight: '600', lineHeight: 21, marginBottom: 8 },
  option: { paddingVertical: 6 },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  optionText: { flex: 1, fontSize: 15, lineHeight: 20 },
  percent: { fontSize: 14, fontVariant: ['tabular-nums'] },
  percentLeading: { fontWeight: '700' },
  track: { height: 4, borderRadius: 2, marginTop: 6, marginLeft: 30, overflow: 'hidden' },
  bar: { height: 4, borderRadius: 2 },
  footer: { fontSize: 12, marginTop: 6 },
});
