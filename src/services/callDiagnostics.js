import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { CALL_CAUSES, safeCallDiagnostic, readCallDiagnostics } from './callDiagnosticFormat';

const KEY = '@callDiagnostics';
const MAX_EVENTS = 400;
const session = Date.now();
export const getCallDiagnosticSession = () => session;
let seq = 0;
let writes = Promise.resolve();

// Только технические коды: без голоса, содержимого сообщений, имён, адресов и токенов.
export const recordCallDiagnostic = (event, details = {}) => {
  const safe = safeCallDiagnostic(event, { ...details, session, seq: ++seq });
  if (!safe) return;
  const entry = { time: new Date().toISOString(), ...safe };
  writes = writes.then(async () => {
    const raw = await AsyncStorage.getItem(KEY);
    const entries = readCallDiagnostics(raw, MAX_EVENTS);
    await AsyncStorage.setItem(KEY, JSON.stringify([...entries, entry].slice(-MAX_EVENTS)));
  }).catch(() => {});
};

export const shareCallDiagnostics = async () => {
  await writes;
  const raw = await AsyncStorage.getItem(KEY);
  const report = { schema: 2, generatedAt: new Date().toISOString(), platform: Platform.OS,
    version: Constants.expoConfig?.version, build: Constants.nativeBuildVersion,
    causes: CALL_CAUSES, events: readCallDiagnostics(raw, MAX_EVENTS) };
  const file = new File(Paths.cache, 'empin-call-diagnostics.json');
  file.write(JSON.stringify(report, null, 2));
  if (!(await Sharing.isAvailableAsync())) throw new Error('Обмен файлами недоступен на устройстве');
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Диагностика звонков', UTI: 'public.json' });
};
