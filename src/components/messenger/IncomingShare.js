import React, { useEffect, useMemo, useRef } from 'react';
import { Platform } from 'react-native';
import { StackActions } from '@react-navigation/native';
import { File, Paths } from 'expo-file-system';
import { useShareIntent } from 'expo-share-intent';
import Toast from 'react-native-toast-message';
import ForwardSheet from '../../screens/Messenger/ForwardSheet';
import { chatRouteParams } from '../../screens/Messenger/ChatsTab';
import { messengerAPI } from '../../services/api';
import { navigationRef } from '../../services/navigationRef';
import { fullName } from '../../utils/chatFormat';
import { MAX_SHARED_FILES, sharedContent } from '../../utils/incomingShare';

const SHARE_OPTIONS = { scheme: 'empinpro', resetOnBackground: false };
const RAW_PATHS = { rawPaths: Platform.OS === 'android' };
const SHARED_FILES_TTL_MS = 3 * 24 * 60 * 60 * 1000;

/** iOS: расширение кладёт файлы в общую папку, и сама она не очищается */
const removeOldSharedFiles = () => {
  if (Platform.OS !== 'ios') return;
  try {
    const cutoff = Date.now() - SHARED_FILES_TTL_MS;
    Object.values(Paths.appleSharedContainers).forEach((container) => {
      container.list().forEach((entry) => {
        if (entry instanceof File && (entry.modificationTime ?? cutoff) < cutoff) entry.delete();
      });
    });
  } catch (error) {
    console.warn('[Share] Очистка общей папки:', error?.message ?? error);
  }
};

const routeParams = async (item) => {
  if (item.kind === 'staff') return { chatType: 'direct', staffId: item.person.id, staffName: fullName(item.person) };
  if (item.chat) return chatRouteParams(item.chat);
  const saved = await messengerAPI.getSavedChat();
  return { chatType: 'saved', chatId: saved.chat_id, title: saved.title };
};

/**
 * «Поделиться» из другого приложения в наше, как в Telegram: выбор чата, затем чат с текстом и вложениями
 * в поле ввода — можно дописать подпись и отправить. Без входа в аккаунт содержимое ждёт входа.
 */
export const IncomingShare = ({ isLoggedIn }) => {
  const { hasShareIntent, shareIntent, resetShareIntent, error } = useShareIntent(SHARE_OPTIONS);
  const content = useMemo(
    () => (hasShareIntent ? sharedContent(shareIntent, RAW_PATHS) : null),
    [hasShareIntent, shareIntent],
  );
  const wasLoggedIn = useRef(isLoggedIn);

  useEffect(removeOldSharedFiles, []);

  useEffect(() => {
    // После выхода из аккаунта не отправляем от имени следующего пользователя
    if (wasLoggedIn.current && !isLoggedIn) resetShareIntent();
    wasLoggedIn.current = isLoggedIn;
  }, [isLoggedIn]);

  useEffect(() => {
    if (content && !isLoggedIn) {
      Toast.show({ type: 'info', text1: 'Войдите, чтобы отправить', text2: 'После входа выберете чат', position: 'top' });
    }
  }, [content, isLoggedIn]);

  useEffect(() => {
    if (!error) return;
    console.warn('[Share] Не удалось получить файл:', error);
    Toast.show({ type: 'error', text1: 'Не удалось получить файл', text2: 'Попробуйте поделиться ещё раз', position: 'top' });
  }, [error]);

  const pick = async (item) => {
    try {
      const params = await routeParams(item);
      navigationRef.dispatch(StackActions.push('Chat', { ...params, shared: { text: content.text, files: content.files } }));
      if (content.dropped) {
        Toast.show({ type: 'info', text1: `Добавлены первые ${MAX_SHARED_FILES} файлов`, text2: 'Больше за один раз не отправить', position: 'top' });
      }
      resetShareIntent();
    } catch {
      Toast.show({ type: 'error', text1: 'Не удалось открыть чат', text2: 'Проверьте интернет и попробуйте ещё раз', position: 'top' });
    }
  };

  return (
    <ForwardSheet
      visible={Boolean(isLoggedIn && content)}
      title="Отправить в…"
      onPick={pick}
      onClose={() => resetShareIntent()}
    />
  );
};
