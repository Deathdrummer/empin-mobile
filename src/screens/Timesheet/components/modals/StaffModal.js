import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Sheet } from '../../../../components/ui/Sheet';
import { Avatar } from '../../../../components/chat/Avatar';
import { useTheme, useThemedStyles } from '../../../../theme';

export const StaffModal = ({ visible, staffList, onClose, onSelectStaff }) => {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);

  return (
    <Sheet visible={visible} onClose={onClose} title="Выберите сотрудника">
      <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
        {staffList.map((staff) => (
          <Pressable
            key={staff.id}
            style={({ pressed }) => [styles.item, pressed && { backgroundColor: theme.surfacePressed }]}
            onPress={() => onSelectStaff(staff.id, `${staff.sname} ${staff.fname} ${staff.mname}`)}
          >
            <Avatar person={staff} id={staff.id} size={40} />
            <View style={styles.itemBody}>
              <Text style={styles.itemText} numberOfLines={2}>
                {staff.sname} {staff.fname} {staff.mname}
              </Text>
            </View>
          </Pressable>
        ))}
        {staffList.length === 0 ? <Text style={styles.empty}>Список сотрудников пуст</Text> : null}
      </ScrollView>
    </Sheet>
  );
};

const makeStyles = (theme) => StyleSheet.create({
  list: {
    flexGrow: 0,
    flexShrink: 1,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingLeft: 20,
  },
  itemBody: {
    flex: 1,
    minHeight: 58,
    justifyContent: 'center',
    paddingRight: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.separator,
  },
  itemText: {
    fontSize: 16,
    color: theme.text,
  },
  empty: {
    fontSize: 15,
    color: theme.textSecondary,
    textAlign: 'center',
    paddingVertical: 32,
  },
});
