import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { Platform } from 'react-native';
import permissionsEmitter from '../utils/permissionsEmitter';
import { getInstallationId } from './deviceInstallation';

const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://empin-pro.ru/api')
  .replace(/\/$/, '');

// URL сервера без /api для доступа к файлам
export const SERVER_URL = API_BASE_URL.replace('/api', '');

const MESSAGE_REFRESH_TIMEOUT_MS = 15000;
const MESSAGE_SEND_TIMEOUT_MS = 30000;

// Создаем экземпляр axios
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Rate limit guard — пауза после получения 429
let _rateLimitPausedUntil = 0;
export const isRateLimited = () => Date.now() < _rateLimitPausedUntil;
export const getRateLimitRemainingMs = () => Math.max(0, _rateLimitPausedUntil - Date.now());

// Добавляем токен к каждому запросу
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Callback для обработки выхода из системы
let onUnauthorizedCallback = null;

export const setUnauthorizedCallback = (callback) => {
  onUnauthorizedCallback = callback;
};

// Перехватчик ответов: 401 — выход на экран входа.
// Сетевые сбои приложение не блокирует: после возврата из фона iOS какое-то время поднимает сеть,
// и одиночная ошибка — не повод перекрывать экран. Ошибку показывает тот экран, где она важна
// (звонок, отправка сообщения), а списки обновятся при следующей загрузке.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('user');
      await AsyncStorage.removeItem('permissions');

      if (onUnauthorizedCallback) {
        onUnauthorizedCallback();
      }
    }
    return Promise.reject(error);
  }
);

// API методы
export const authAPI = {
  login: async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    if (response.data.token) {
      const permissions = response.data.user.permissions || [];
      // Сохраняем токен, пользователя и права
      await AsyncStorage.setItem('token', response.data.token);
      await AsyncStorage.setItem('user', JSON.stringify(response.data.user));
      await AsyncStorage.setItem('permissions', JSON.stringify(permissions));
      // Даем время AsyncStorage на синхронизацию
      await new Promise((resolve) => setTimeout(resolve, 100));
      // Эмитим событие об обновлении прав
      permissionsEmitter.emit(permissions);
    }
    return response.data;
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch (_error) {
      // Игнорируем ошибки logout на сервере
    }
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('user');
    await AsyncStorage.removeItem('permissions');
    // Эмитим событие об очистке прав
    permissionsEmitter.emit([]);
  },

  me: async () => {
    const response = await api.get('/auth/me');
    // Обновляем сохраненные права при запросе /me
    if (response.data.permissions) {
      const permissions = response.data.permissions;
      await AsyncStorage.setItem('permissions', JSON.stringify(permissions));
      // Эмитим событие об обновлении прав
      permissionsEmitter.emit(permissions);
    }
    return response.data;
  },
};

export const timesheetAPI = {
  getSlides: async (indexes, filters = null) => {
    const requestBody = { indexes };

    // Добавляем фильтры в запрос, если они есть
    if (filters && (filters.teams?.length > 0 || filters.contracts?.length > 0)) {
      requestBody.filters = filters;
    }

    const response = await api.post('/timesheet/slides', requestBody);
    return response.data;
  },

  getSlide: async (index) => {
    const response = await api.post('/timesheet/slide', { index });
    return response.data;
  },

  getStaff: async () => {
    const response = await api.get('/timesheet/staff');
    return response.data;
  },

  getAllStaff: async () => {
    const response = await api.get('/timesheet/all-staff');
    return response.data;
  },

  getFilterOptions: async () => {
    const response = await api.get('/timesheet/filter-options');
    return response.data;
  },

  searchFilterTeams: async (search) => {
    const response = await api.get('/timesheet/filter-options/teams/search', {
      params: { search: search || '' },
    });
    return response.data;
  },

  searchFilterContracts: async (search) => {
    const response = await api.get('/timesheet/filter-options/contracts/search', {
      params: { search: search || '' },
    });
    return response.data;
  },

  searchAllFilterContracts: async (search) => {
    const response = await api.get('/timesheet/filter-options/contracts/search-all', {
      params: { search: search || '' },
    });
    return response.data;
  },

  searchContracts: async (search) => {
    const response = await api.get('/timesheet/contracts/search', {
      params: { search },
    });
    return response.data;
  },

  addTeam: async (staffId, day) => {
    const response = await api.post('/timesheet/team', {
      staff_id: staffId,
      day,
    });
    return response.data;
  },

  removeTeam: async (id) => {
    const response = await api.delete(`/timesheet/team/${id}`);
    return response.data;
  },

  addContract: async (contractId, teamId) => {
    const response = await api.post('/timesheet/contract', {
      contract_id: contractId,
      team_id: teamId,
    });
    return response.data;
  },

  removeContract: async (id) => {
    const response = await api.delete(`/timesheet/contract/${id}`);
    return response.data;
  },

  addComment: async (timesheetContractId, message, replyToId = null, mediaArray = []) => {
    // Если есть медиа, используем FormData
    if (mediaArray && mediaArray.length > 0) {
      const formData = new FormData();
      formData.append('timesheet_contract_id', timesheetContractId);
      formData.append('message', message);
      if (replyToId) {
        formData.append('reply_to_id', replyToId);
      }

      // Добавляем все медиа файлы в FormData
      mediaArray.forEach((media, index) => {

        // Извлекаем имя файла и расширение из URI или name
        const fileName = media.name || media.fileName || media.uri.split('/').pop();

        // Используем mimeType из media, если есть, иначе определяем по расширению
        let mimeType = media.mimeType;

        if (!mimeType) {
          const extension = fileName.split('.').pop().toLowerCase();
          const mimeTypes = {
            // Изображения
            jpg: 'image/jpeg',
            jpeg: 'image/jpeg',
            png: 'image/png',
            gif: 'image/gif',
            bmp: 'image/bmp',
            webp: 'image/webp',
            // Видео
            mp4: 'video/mp4',
            mov: 'video/quicktime',
            avi: 'video/x-msvideo',
            mkv: 'video/x-matroska',
            // Документы
            pdf: 'application/pdf',
            doc: 'application/msword',
            docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            xls: 'application/vnd.ms-excel',
            xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            ppt: 'application/vnd.ms-powerpoint',
            pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            // Архивы
            zip: 'application/zip',
            rar: 'application/x-rar-compressed',
            '7z': 'application/x-7z-compressed',
            // Текст
            txt: 'text/plain',
            csv: 'text/csv',
            // Аудио
            mp3: 'audio/mpeg',
            wav: 'audio/wav',
            ogg: 'audio/ogg',
            aac: 'audio/aac',
            flac: 'audio/flac',
            m4a: 'audio/x-m4a',
          };
          mimeType = mimeTypes[extension] || 'application/octet-stream';
        }

        const mediaFile = {
          uri: media.uri,
          name: fileName,
          type: mimeType,
        };

        // Используем media[] для отправки массива
        formData.append('media[]', mediaFile);
      });

      const response = await api.post('/timesheet/comment', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    }

    // Если медиа нет, используем обычный JSON
    const response = await api.post('/timesheet/comment', {
      timesheet_contract_id: timesheetContractId,
      message,
      reply_to_id: replyToId,
    }, { timeout: MESSAGE_SEND_TIMEOUT_MS });
    return response.data;
  },

  removeComment: async (id) => {
    const response = await api.delete(`/timesheet/comment/${id}`);
    return response.data;
  },

  updateComment: async (id, message) => {
    const response = await api.put(`/timesheet/comment/${id}`, { message });
    return response.data;
  },

  addReaction: async (commentId, emoji) => {
    const response = await api.post('/timesheet/comment/reaction', {
      comment_id: commentId,
      emoji,
    });
    return response.data;
  },

  // Сервер переключает реакцию: повтор той же снимает её (отдельного DELETE-маршрута нет)
  removeReaction: async (commentId, emoji) => {
    const response = await api.post('/timesheet/comment/reaction', {
      comment_id: commentId,
      emoji,
    });
    return response.data;
  },
};

export const messengerAPI = {
  getOrCreateChat: async (participantId) => {
    const response = await api.post('/messenger/chat', {
      participant_id: participantId,
    });
    return response.data;
  },

  getMessages: async (chatId) => {
    const response = await api.post('/messenger/chat/messages', {
      chat_id: chatId,
    }, { timeout: MESSAGE_REFRESH_TIMEOUT_MS });
    return response.data;
  },

  // Список чатов: собеседник, последнее сообщение, непрочитанные
  getChats: async () => {
    const response = await api.get('/messenger/chats', { timeout: MESSAGE_REFRESH_TIMEOUT_MS });
    return response.data;
  },

  // История порциями: последние limit сообщений до beforeId, новые после afterId или окно вокруг aroundId
  getMessagesPage: async (chatId, { limit = 40, beforeId = null, afterId = null, aroundId = null } = {}) => {
    const response = await api.post('/messenger/chat/messages', {
      chat_id: chatId,
      limit,
      before_id: beforeId,
      after_id: afterId,
      around_id: aroundId,
    }, { timeout: MESSAGE_REFRESH_TIMEOUT_MS });
    return response.data;
  },

  // Заголовок чата: «в сети», участники группы, закреплённые сообщения
  getChatInfo: async (chatId) => {
    const response = await api.get('/messenger/chat/info', { params: { chat_id: chatId }, timeout: MESSAGE_REFRESH_TIMEOUT_MS });
    return response.data;
  },

  // Чат объекта (договора) — из поиска или табеля
  openObjectChat: async (contractId) => {
    const response = await api.post('/messenger/object/open', { contract_id: contractId });
    return response.data;
  },

  // Комментарии объекта просмотрены в табеле
  markObjectRead: async (contractId) => {
    const response = await api.post('/messenger/object/read', { contract_id: contractId });
    return response.data;
  },

  pinChat: async (chatId, pinned) => {
    const response = await api.post('/messenger/chat/pin', { chat_id: chatId, pinned });
    return response.data;
  },

  muteChat: async (chatId, muted) => {
    const response = await api.post('/messenger/chat/mute', { chat_id: chatId, muted });
    return response.data;
  },

  pinMessage: async (chatId, messageId, pinned) => {
    const response = await api.post('/messenger/message/pin', { chat_id: chatId, message_id: messageId, pinned });
    return response.data;
  },

  // Опрос в группе: poll = { question, options: [..], multiple }
  addPoll: async (chatId, poll) => {
    const response = await api.post('/messenger/message', { chat_id: chatId, type: 'poll', poll }, { timeout: MESSAGE_SEND_TIMEOUT_MS });
    return response.data;
  },

  // Голос в опросе; пустой массив — отозвать голос
  votePoll: async (messageId, options) => {
    const response = await api.post('/messenger/poll/vote', { message_id: messageId, options });
    return response.data;
  },

  // Поиск по сообщениям во всех чатах (или в одном chatId), группам и объектам
  search: async (query, chatId = null) => {
    const response = await api.get('/messenger/search', {
      params: { q: query, chat_id: chatId || undefined },
      timeout: MESSAGE_REFRESH_TIMEOUT_MS,
    });
    return response.data;
  },

  // Приложение открыто — «в сети»
  presence: async () => {
    await api.post('/messenger/presence');
  },

  createGroup: async (title, memberIds) => {
    const response = await api.post('/messenger/group', { title, member_ids: memberIds });
    return response.data;
  },

  renameGroup: async (chatId, title) => {
    const response = await api.post('/messenger/group/rename', { chat_id: chatId, title });
    return response.data;
  },

  addGroupMembers: async (chatId, memberIds) => {
    const response = await api.post('/messenger/group/members/add', { chat_id: chatId, member_ids: memberIds });
    return response.data;
  },

  removeGroupMember: async (chatId, staffId) => {
    const response = await api.post('/messenger/group/members/remove', { chat_id: chatId, staff_id: staffId });
    return response.data;
  },

  leaveGroup: async (chatId) => {
    const response = await api.post('/messenger/group/leave', { chat_id: chatId });
    return response.data;
  },

  // Состав чата объекта: участников подбирает табель, здесь их меняют вручную
  addObjectMembers: async (chatId, memberIds) => {
    const response = await api.post('/messenger/object/members/add', { chat_id: chatId, member_ids: memberIds });
    return response.data;
  },

  removeObjectMember: async (chatId, staffId) => {
    const response = await api.post('/messenger/object/members/remove', { chat_id: chatId, staff_id: staffId });
    return response.data;
  },

  leaveObject: async (chatId) => {
    const response = await api.post('/messenger/object/leave', { chat_id: chatId });
    return response.data;
  },

  // Переслать сообщения в чаты и сотрудникам (личный чат создаётся сам).
  // clientKey — ключ попытки: повтор после обрыва связи сервер не перешлёт второй раз
  forward: async (chatId, messageIds, { chatIds = [], staffIds = [], clientKey } = {}) => {
    const response = await api.post('/messenger/forward', {
      chat_id: chatId,
      message_ids: messageIds,
      target_chat_ids: chatIds,
      target_staff_ids: staffIds,
      client_key: clientKey,
    });
    return response.data;
  },

  // Аватарка: квадратный JPEG, уже уменьшенный на телефоне
  uploadAvatar: async (uri) => {
    const formData = new FormData();
    formData.append('avatar', { uri, name: 'avatar.jpg', type: 'image/jpeg' });
    const response = await api.post('/messenger/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: MESSAGE_SEND_TIMEOUT_MS,
    });
    return response.data;
  },

  deleteAvatar: async () => {
    const response = await api.delete('/messenger/avatar');
    return response.data;
  },

  // Настройки мессенджера — общие для всех устройств сотрудника
  getSettings: async () => {
    const response = await api.get('/messenger/settings');
    return response.data;
  },

  updateSettings: async (settings) => {
    const response = await api.post('/messenger/settings', settings);
    return response.data;
  },

  markRead: async (chatId, messageId) => {
    const response = await api.post('/messenger/chat/read', {
      chat_id: chatId,
      message_id: messageId,
    });
    return response.data;
  },

  typing: async (chatId) => {
    await api.post('/messenger/chat/typing', { chat_id: chatId });
  },

  addMessage: async (chatId, message, replyToId = null, mediaArray = [], { mentionIds = [] } = {}) => {
    // Если есть медиа, используем FormData
    if (mediaArray && mediaArray.length > 0) {
      const formData = new FormData();
      formData.append('chat_id', chatId);
      formData.append('message', message);
      if (replyToId) {
        formData.append('reply_to_id', replyToId);
      }
      mentionIds.forEach((id) => formData.append('mention_ids[]', id));

      // Добавляем все медиа файлы в FormData
      mediaArray.forEach((media, index) => {
        // Извлекаем имя файла и расширение из URI или name
        const fileName = media.name || media.fileName || media.uri.split('/').pop();

        // Используем mimeType из media, если есть, иначе определяем по расширению
        let mimeType = media.mimeType;

        if (!mimeType) {
          const extension = fileName.split('.').pop().toLowerCase();
          const mimeTypes = {
            // Изображения
            jpg: 'image/jpeg',
            jpeg: 'image/jpeg',
            png: 'image/png',
            gif: 'image/gif',
            bmp: 'image/bmp',
            webp: 'image/webp',
            // Видео
            mp4: 'video/mp4',
            mov: 'video/quicktime',
            avi: 'video/x-msvideo',
            mkv: 'video/x-matroska',
            // Документы
            pdf: 'application/pdf',
            doc: 'application/msword',
            docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            xls: 'application/vnd.ms-excel',
            xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            ppt: 'application/vnd.ms-powerpoint',
            pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            // Архивы
            zip: 'application/zip',
            rar: 'application/x-rar-compressed',
            '7z': 'application/x-7z-compressed',
            // Текст
            txt: 'text/plain',
            csv: 'text/csv',
            // Аудио
            mp3: 'audio/mpeg',
            wav: 'audio/wav',
            ogg: 'audio/ogg',
            aac: 'audio/aac',
            flac: 'audio/flac',
            m4a: 'audio/x-m4a',
          };
          mimeType = mimeTypes[extension] || 'application/octet-stream';
        }

        const mediaFile = {
          uri: media.uri,
          name: fileName,
          type: mimeType,
        };

        // Используем media[] для отправки массива
        formData.append('media[]', mediaFile);
      });

      const response = await api.post('/messenger/message', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    }

    // Если медиа нет, используем обычный JSON
    const response = await api.post('/messenger/message', {
      chat_id: chatId,
      message,
      reply_to_id: replyToId,
      mention_ids: mentionIds.length ? mentionIds : undefined,
    }, { timeout: MESSAGE_SEND_TIMEOUT_MS });
    return response.data;
  },

  // chatId нужен для чата объекта: там сообщения — комментарии табеля
  updateMessage: async (id, message, chatId = null) => {
    const response = await api.put(`/messenger/message/${id}`, { message, chat_id: chatId || undefined });
    return response.data;
  },

  removeMessage: async (id, chatId = null) => {
    const response = await api.delete(`/messenger/message/${id}`, { params: { chat_id: chatId || undefined } });
    return response.data;
  },

  addReaction: async (messageId, emoji, chatId = null) => {
    const response = await api.post('/messenger/message/reaction', {
      message_id: messageId,
      emoji,
      chat_id: chatId || undefined,
    });
    return response.data;
  },

  removeReaction: async (messageId, emoji) => {
    const response = await api.post('/messenger/message/reaction', {
      message_id: messageId,
      emoji,
    });
    return response.data;
  },

  // Calls API
  initiateCall: async (calleeId) => {
    const response = await api.post('/messenger/calls/initiate', {
      callee_id: calleeId,
    });
    return response.data;
  },

  acceptCall: async (callId) => {
    const response = await api.post(`/messenger/calls/${callId}/accept`);
    return response.data;
  },

  rejectCall: async (callId) => {
    const response = await api.post(`/messenger/calls/${callId}/reject`);
    return response.data;
  },

  endCall: async (callId) => {
    const response = await api.post(`/messenger/calls/${callId}/end`);
    return response.data;
  },

  getCallHistory: async () => {
    // Сервер по умолчанию отдаёт 20 звонков; 100 — его максимум за запрос
    const response = await api.get('/messenger/calls/history', { params: { per_page: 100 } });
    return response.data;
  },

  // Регистрация Expo Push Token
  registerPushToken: async (token, platform = Platform.OS) => {
    const installationId = await getInstallationId();
    const response = await api.post('/messenger/calls/push-token', {
      token,
      platform,
      token_type: 'expo',
      installation_id: installationId,
    });
    return response.data;
  },

  unregisterPushToken: async (token) => {
    const response = await api.delete('/messenger/calls/push-token', {
      data: { token },
    });
    return response.data;
  },

  // Отдельный APNs VoIP token для PushKit/CallKit на iOS
  registerVoipToken: async (token) => {
    const installationId = await getInstallationId();
    const response = await api.post('/messenger/calls/voip-token', {
      token,
      platform: 'ios',
      token_type: 'voip',
      installation_id: installationId,
    });
    return response.data;
  },

  unregisterVoipToken: async (token) => {
    const response = await api.delete('/messenger/calls/voip-token', {
      data: { token },
    });
    return response.data;
  },

  // Polling: проверка входящих звонков (оставлен как fallback)
  getPendingCall: async () => {
    const response = await api.get('/messenger/calls/pending');
    return response.data;
  },

  getCallDetails: async (callId) => {
    const response = await api.get(`/messenger/calls/${callId}`);
    return response.data;
  },
};

export default api;
