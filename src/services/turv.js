import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import api, { SERVER_URL } from './api';

/**
 * ТУРВ (ТЗ, раздел 7): табель месяца, корректировка ячейки (право 18), порядок за учётной записью, выгрузка.
 * Табель требует связи; корректировка — только при связи (п. 9.1)
 */
const READ = { timeout: 20000 };
const WRITE = { timeout: 30000 };

export const turvAPI = {
  month: async (month) => (await api.get('/production/turv', { ...READ, params: { month } })).data,
  cell: async (body) => (await api.post('/production/turv/cell', body, WRITE)).data,
  order: async (body) => (await api.put('/production/turv/order', body, WRITE)).data,
};

const MIME = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pdf: 'application/pdf',
};

/** Выгрузить файл ровно в том порядке, что на экране (инт. 8.56), и открыть «Поделиться» */
export const exportTurv = async (month, format, order) => {
  const token = await AsyncStorage.getItem('token');
  const query = `month=${month}&format=${format}&order=${encodeURIComponent(JSON.stringify(order))}`;
  const dir = new Directory(Paths.cache, 'turv');
  if (!dir.exists) dir.create();
  const target = new File(dir, `Табель ${month}.${format}`);
  if (target.exists) target.delete();
  const file = await File.downloadFileAsync(`${SERVER_URL}/api/production/turv/export?${query}`, target, {
    headers: { Authorization: `Bearer ${token}`, Accept: MIME[format] },
  });
  await Sharing.shareAsync(file.uri, { mimeType: MIME[format], dialogTitle: `Табель ${month}` });
};
