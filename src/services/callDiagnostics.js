import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

const KEY = '@callDiagnostics';
const MAX_EVENTS = 160;
const ALLOWED_FIELDS = ['state', 'reason', 'code', 'status', 'callId', 'uid'];
let writes = Promise.resolve();

// Только технические коды: без голоса, содержимого сообщений, имён, адресов и токенов.
export const recordCallDiagnostic = (event, details = {}) => {
  const safe = Object.fromEntries(ALLOWED_FIELDS
    .filter((key) => typeof details[key] === 'number' || /^\d+$/.test(String(details[key] ?? '')))
    .map((key) => [key, details[key]]));
  const entry = { time: new Date().toISOString(), event, ...safe };
  writes = writes.then(async () => {
    const raw = await AsyncStorage.getItem(KEY);
    let entries;
    try { entries = raw ? JSON.parse(raw) : []; } catch { entries = []; }
    await AsyncStorage.setItem(KEY, JSON.stringify([...entries, entry].slice(-MAX_EVENTS)));
  }).catch(() => {});
};

export const shareCallDiagnostics = async () => {
  await writes;
  const raw = await AsyncStorage.getItem(KEY);
  const report = { platform: Platform.OS, version: Constants.expoConfig?.version,
    build: Constants.nativeBuildVersion, events: raw ? JSON.parse(raw) : [] };
  const file = new File(Paths.cache, 'empin-call-diagnostics.json');
  file.write(JSON.stringify(report, null, 2));
  if (!(await Sharing.isAvailableAsync())) throw new Error('Обмен файлами недоступен на устройстве');
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Диагностика звонков', UTI: 'public.json' });
};
