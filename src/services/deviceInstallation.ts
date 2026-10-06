import AsyncStorage from '@react-native-async-storage/async-storage';

const INSTALLATION_ID_STORAGE_KEY = '@pushInstallationId';
let installationIdPromise: Promise<string> | null = null;

const createInstallationId = (): string => {
  const randomPart = Math.random().toString(36).slice(2);
  return `${Date.now().toString(36)}-${randomPart}-${Math.random().toString(36).slice(2)}`;
};

export const getInstallationId = async (): Promise<string> => {
  if (!installationIdPromise) {
    installationIdPromise = (async () => {
      const existingId = await AsyncStorage.getItem(INSTALLATION_ID_STORAGE_KEY);
      if (existingId) return existingId;

      const installationId = createInstallationId();
      await AsyncStorage.setItem(INSTALLATION_ID_STORAGE_KEY, installationId);
      return installationId;
    })().catch((error) => {
      installationIdPromise = null;
      throw error;
    });
  }

  return installationIdPromise;
};
