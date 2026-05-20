import { Alert, Linking } from 'react-native';

export const isPermissionError = (error) => {
  const errorText = `${error?.code || ''} ${error?.message || ''}`.toLowerCase();

  return (
    errorText.includes('permission') ||
    errorText.includes('denied') ||
    errorText.includes('unauthorized') ||
    errorText.includes('not authorized') ||
    errorText.includes('securityexception')
  );
};

export const showPermissionSettingsAlert = (title, message) => {
  Alert.alert(title, message, [
    { text: 'Отмена', style: 'cancel' },
    {
      text: 'Настройки',
      onPress: () => {
        Linking.openSettings();
      },
    },
  ]);
};
