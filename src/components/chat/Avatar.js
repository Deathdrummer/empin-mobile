import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { avatarColor } from '../../theme';
import { initials } from '../../utils/chatFormat';

/** Аватар сотрудника: инициалы на постоянном для него цвете */
export const Avatar = ({ person, id, size = 48 }) => (
  <View
    style={[
      styles.avatar,
      { width: size, height: size, borderRadius: size / 2, backgroundColor: avatarColor(id ?? person?.id) },
    ]}
  >
    <Text style={[styles.text, { fontSize: Math.round(size * 0.36) }]}>{initials(person)}</Text>
  </View>
);

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#FFFFFF',
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
