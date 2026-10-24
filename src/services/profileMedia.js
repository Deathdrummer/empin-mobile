import { Linking, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { restoreStatusBar } from '../utils/statusBar';

const AVATAR_SIZE = 512;

const openSettingsAlert = (title) => Alert.alert(title, 'Разрешите доступ в настройках телефона.', [
  { text: 'Отмена', style: 'cancel' },
  { text: 'Настройки', onPress: () => Linking.openSettings() },
]);

/**
 * Фото для аватарки: из галереи или с камеры, квадратная обрезка в системном окне,
 * затем уменьшение до 512×512 JPEG (≈50 КБ) — в списках чатов грузится мгновенно.
 * Возвращает локальный адрес файла или null (отмена, нет доступа).
 */
export const pickAvatarPhoto = async (source) => {
  const permission = source === 'camera'
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    openSettingsAlert(source === 'camera' ? 'Доступ к камере' : 'Доступ к фото');
    return null;
  }

  const options = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 1 };
  const result = source === 'camera'
    ? await ImagePicker.launchCameraAsync({ ...options, cameraType: ImagePicker.CameraType.front })
    : await ImagePicker.launchImageLibraryAsync(options);
  restoreStatusBar();
  if (result.canceled || !result.assets?.[0]) return null;

  const asset = result.assets[0];
  const side = Math.min(asset.width || AVATAR_SIZE, asset.height || AVATAR_SIZE);
  // Обрезка до квадрата на случай, если система вернула не квадрат (на Android бывает)
  const crop = asset.width && asset.height && asset.width !== asset.height
    ? [{ crop: { originX: (asset.width - side) / 2, originY: (asset.height - side) / 2, width: side, height: side } }]
    : [];
  const resized = await manipulateAsync(
    asset.uri,
    [...crop, { resize: { width: AVATAR_SIZE, height: AVATAR_SIZE } }],
    { compress: 0.82, format: SaveFormat.JPEG },
  );
  return resized.uri;
};
