import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { avatarColor, useTheme } from '../../theme';
import { Avatar } from './Avatar';

const OBJECT_COLOR = '#C46A1B';

/** «Бригада Иванова» → «БИ» */
const titleInitials = (title) => {
  const words = String(title || '').trim().split(/\s+/).filter(Boolean);
  return (words.slice(0, 2).map((word) => word.charAt(0).toUpperCase()).join('')) || '?';
};

/**
 * Аватар чата по типу: сотрудник (с точкой «в сети»), группа (инициалы названия), объект (значок молнии).
 * chat — элемент списка или сведения о чате: { type, chat_id, title, participant, object }.
 */
export const ChatAvatar = ({ chat, size = 52, showOnline = true }) => {
  const theme = useTheme();
  const dot = Math.max(10, Math.round(size * 0.24));

  if (chat?.type === 'object') {
    return (
      <View style={[styles.center, { width: size, height: size, borderRadius: Math.round(size * 0.3), backgroundColor: OBJECT_COLOR }]}>
        <Ionicons name="flash" size={Math.round(size * 0.46)} color="#FFFFFF" />
      </View>
    );
  }

  if (chat?.type === 'group') {
    return (
      <View style={[styles.center, { width: size, height: size, borderRadius: size / 2, backgroundColor: avatarColor(chat.chat_id) }]}>
        <Text style={[styles.initials, { fontSize: Math.round(size * 0.34) }]}>{titleInitials(chat.title)}</Text>
        <View style={[styles.groupBadge, { width: dot + 4, height: dot + 4, borderRadius: (dot + 4) / 2, borderColor: theme.background, backgroundColor: theme.textSecondary }]}>
          <Ionicons name="people" size={Math.round(dot * 0.7)} color="#FFFFFF" />
        </View>
      </View>
    );
  }

  const person = chat?.participant;
  return (
    <View>
      <Avatar person={person} id={person?.id} size={size} />
      {showOnline && person?.online ? (
        <View
          style={[
            styles.online,
            { width: dot, height: dot, borderRadius: dot / 2, backgroundColor: theme.online, borderColor: theme.background },
          ]}
        />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  initials: { color: '#FFFFFF', fontWeight: '600', letterSpacing: 0.3 },
  online: { position: 'absolute', right: 0, bottom: 0, borderWidth: 2 },
  groupBadge: { position: 'absolute', right: -2, bottom: -2, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
