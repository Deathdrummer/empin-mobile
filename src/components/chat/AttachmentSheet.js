import React from 'react';
import { Alert, Linking, Modal, Platform, Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import Toast from 'react-native-toast-message';

const openSettingsAlert = (title, message) => {
  Alert.alert(title, message, [
    { text: 'Отмена', style: 'cancel' },
    { text: 'Настройки', onPress: () => Linking.openSettings() },
  ]);
};

const isPermissionError = (error) => /permission|denied|разреш/i.test(error?.message ?? '');

/** Снимок камерой сразу из поля ввода; null — отменили или нет доступа */
export const takePhoto = async () => {
  try {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      openSettingsAlert('Доступ к камере', 'Разрешите доступ к камере в настройках телефона.');
      return null;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
    StatusBar.setHidden(true);
    return result.canceled ? null : result.assets;
  } catch (error) {
    StatusBar.setHidden(true);
    console.warn('[Attach] Камера:', error?.message ?? error);
    Toast.show({ type: 'error', text1: 'Не удалось открыть камеру', position: 'top' });
    return null;
  }
};

/**
 * Выбор вложений: галерея, камера (фото и видео), файл. onPicked(assets) — в формате expo-image/document-picker.
 * extraOptions — дополнительные пункты (например, «Опрос» в группе): [{ key, label, icon, color, onPress }].
 */
export const AttachmentSheet = ({ visible, theme, onClose, onPicked, extraOptions = [] }) => {
  const run = async (picker) => {
    onClose();
    // iOS не показывает системное окно, пока закрывается наше
    await new Promise((resolve) => setTimeout(resolve, Platform.OS === 'ios' ? 450 : 0));
    try {
      const assets = await picker();
      // Системные окна выбора показывают статус-бар, а приложение работает без него
      StatusBar.setHidden(true);
      if (assets?.length) onPicked(assets);
    } catch (error) {
      StatusBar.setHidden(true);
      if (isPermissionError(error)) {
        openSettingsAlert('Нет доступа', 'Разрешите доступ в настройках телефона, чтобы прикрепить файл.');
        return;
      }
      console.warn('[Attach] Не удалось выбрать вложение:', error?.message ?? error);
      Toast.show({ type: 'error', text1: 'Не удалось прикрепить', text2: 'Попробуйте ещё раз', position: 'top' });
    }
  };

  const camera = (mediaTypes) => async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      openSettingsAlert('Доступ к камере', 'Разрешите доступ к камере в настройках телефона.');
      return null;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes, quality: 0.8 });
    return result.canceled ? null : result.assets;
  };

  const options = [
    {
      key: 'gallery',
      label: 'Галерея',
      icon: 'images',
      color: '#3B82F6',
      action: async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images', 'videos'],
          quality: 0.8,
          allowsMultipleSelection: true,
          selectionLimit: 10,
        });
        return result.canceled ? null : result.assets;
      },
    },
    { key: 'photo', label: 'Камера', icon: 'camera', color: theme.accent, action: camera(['images']) },
    { key: 'video', label: 'Видео', icon: 'videocam', color: '#8B5CF6', action: camera(['videos']) },
    {
      key: 'file',
      label: 'Файл',
      icon: 'document',
      color: '#0EA5A4',
      action: async () => {
        const result = await DocumentPicker.getDocumentAsync({ type: '*/*', multiple: true, copyToCacheDirectory: true });
        return result.canceled ? null : result.assets;
      },
    },
  ];

  const extra = extraOptions.map((option) => ({
    ...option,
    action: null,
    onSelect: () => {
      onClose();
      option.onPress();
    },
  }));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[styles.backdrop, { backgroundColor: theme.overlay }]} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: theme.sheet }]}>
          <View style={[styles.handle, { backgroundColor: theme.separator }]} />
          <View style={styles.grid}>
            {[...options, ...extra].map((option) => (
              <Pressable key={option.key} style={styles.option} onPress={() => (option.onSelect ? option.onSelect() : run(option.action))}>
                <View style={[styles.icon, { backgroundColor: option.color }]}>
                  <Ionicons name={option.icon} size={26} color="#FFFFFF" />
                </View>
                <Text style={[styles.label, { color: theme.text }]}>{option.label}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingTop: 8, paddingBottom: 34, paddingHorizontal: 16 },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, marginBottom: 18 },
  // Четыре колонки: пятый пункт («Опрос») встаёт под первым, а не по центру
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 16 },
  option: { alignItems: 'center', gap: 8, width: '25%' },
  icon: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 13, fontWeight: '500' },
});
