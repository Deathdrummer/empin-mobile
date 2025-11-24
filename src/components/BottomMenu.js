import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function BottomMenu({ onLogout, onCalendarPress }) {
  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.menuItem} onPress={onCalendarPress} activeOpacity={0.7}>
        <Ionicons name="calendar-outline" size={28} color="#999999" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.menuItem} onPress={() => {}} activeOpacity={0.7}>
        {/* Пустая секция 2 */}
      </TouchableOpacity>

      <TouchableOpacity style={styles.menuItem} onPress={() => {}} activeOpacity={0.7}>
        {/* Пустая секция 3 */}
      </TouchableOpacity>

      <TouchableOpacity style={styles.menuItem} onPress={onLogout} activeOpacity={0.7}>
        <Ionicons name="log-out-outline" size={28} color="#999999" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e2dde7',
    height: 48,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  menuItem: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
