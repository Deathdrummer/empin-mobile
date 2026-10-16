import React, { useRef, useEffect } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Sheet } from '../../../../components/ui/Sheet';
import { useTheme, useThemedStyles } from '../../../../theme';

export const ContractModal = ({ visible, contractSearch, contractsList, loading, onClose, onSearchChange, onSelectContract }) => {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const searchInputRef = useRef(null);

  useEffect(() => {
    if (visible && searchInputRef.current) {
      // Небольшая задержка для корректной работы фокуса после открытия модального окна
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  return (
    <Sheet visible={visible} onClose={onClose} title="Добавить объект" keyboard>
      <View style={styles.search}>
        <Ionicons name="search" size={18} color={theme.textMuted} />
        <TextInput
          ref={searchInputRef}
          style={styles.searchInput}
          placeholder="Номер или название договора"
          placeholderTextColor={theme.textMuted}
          value={contractSearch}
          onChangeText={onSearchChange}
          returnKeyType="search"
        />
      </View>
      <View style={styles.listWrapper}>
        <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
          {contractsList.map((contract) => (
            <Pressable
              key={contract.id}
              style={({ pressed }) => [styles.item, pressed && { backgroundColor: theme.surfacePressed }]}
              onPress={() => onSelectContract(contract.id)}
            >
              <Text style={styles.itemNumber}>{contract.object_number}</Text>
              <Text style={styles.itemTitle} numberOfLines={2}>{contract.title}</Text>
            </Pressable>
          ))}
        </ScrollView>
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={theme.accent} />
          </View>
        )}
      </View>
    </Sheet>
  );
};

const makeStyles = (theme) => StyleSheet.create({
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: theme.inputBackground,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 16,
    color: theme.text,
  },
  listWrapper: {
    flexShrink: 1,
    minHeight: 120,
  },
  list: {
    flexGrow: 0,
    flexShrink: 1,
  },
  item: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.separator,
  },
  itemNumber: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.accentText,
    marginBottom: 2,
  },
  itemTitle: {
    fontSize: 16,
    color: theme.text,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.veil,
  },
});
