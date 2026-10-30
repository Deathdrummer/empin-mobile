import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import Toast from 'react-native-toast-message';
import { getUserFacingError } from '../utils/userFacingError';

/**
 * Открыть документ из сообщения: скачать во временную папку и показать системное «Открыть в…»
 * (PDF, Word, Excel — тем приложением, что выберет человек).
 */
export const openDocument = async (file) => {
  try {
    Toast.show({ type: 'info', text1: 'Загрузка файла', text2: file.name, position: 'top', visibilityTime: 1500 });
    const downloadDir = new Directory(Paths.cache, 'downloads');
    if (!downloadDir.exists) downloadDir.create();
    const target = new File(downloadDir, file.name || file.uri.split('/').pop());
    if (target.exists) target.delete();
    const downloaded = await File.downloadFileAsync(file.uri, target);
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(downloaded.uri);
    }
  } catch (error) {
    Toast.show({ type: 'error', text1: 'Не удалось открыть файл', text2: getUserFacingError(error, 'Попробуйте ещё раз.'), position: 'top' });
  }
};
