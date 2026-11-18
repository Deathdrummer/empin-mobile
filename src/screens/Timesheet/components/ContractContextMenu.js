import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme, useThemedStyles } from '../../../theme';

/**
 * Меню долгого нажатия на объекте плана-графика: копирование данных договора и действия с заданием.
 * items: [{ key, label, icon, onPress, danger }] — в меню только то, на что у сотрудника есть право (п. 4.4).
 */
export const ContractContextMenu = ({ position, items }) => {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={[styles.container, { top: position.top }]}>
      {items.map((item, index) => (
        <React.Fragment key={item.key}>
          {index > 0 ? <View style={styles.separator} /> : null}
          <TouchableOpacity style={styles.menuItem} onPress={item.onPress} activeOpacity={0.7}>
            <MaterialCommunityIcons name={item.icon} size={20} color={item.danger ? theme.danger : theme.textSecondary} />
            <Text style={[styles.menuItemText, item.danger && styles.dangerText]}>{item.label}</Text>
          </TouchableOpacity>
        </React.Fragment>
      ))}
    </View>
  );
};

const makeStyles = (theme) => StyleSheet.create({
  container: {
    position: 'absolute',
    alignSelf: 'center',
    minWidth: 240,
    backgroundColor: theme.sheet,
    borderRadius: 14,
    paddingVertical: 4,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: theme.dark ? 0.5 : 0.18,
    shadowRadius: 16,
    zIndex: 1000,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  menuItemText: {
    fontSize: 16,
    color: theme.text,
    textAlign: 'left',
    fontWeight: '400',
    marginLeft: 12,
  },
  dangerText: {
    color: theme.danger,
  },
  separator: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.separator,
    marginLeft: 48,
  },
});
