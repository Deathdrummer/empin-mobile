import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import * as Updates from 'expo-updates';
import { Platform } from 'react-native';
import permissionsEmitter from '../utils/permissionsEmitter';
import apiBlockEmitter from '../utils/apiBlockEmitter';

const API_BASE_URL = 'https://empin-pro.ru/api'; // Production
// const API_BASE_URL = 'http://192.168.0.102/api'; // Local development

// URL сервера без /api для доступа к файлам
export const SERVER_URL = API_BASE_URL.replace('/api', '');

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

// Перехватчик ответов для обработки ошибок авторизации и сети
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Network Error - сервер недоступен
    if (error.message === 'Network Error') {
      // Блокируем приложение
      apiBlockEmitter.block();
    }
    // 401 - невалидный токен, выкидываем пользователя на экран логина
    else if (error.response?.status === 401) {
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

/**
 * Проверить доступность API сервера
 * @returns {Promise<boolean>} true если сервер доступен
 */
export const checkApiAvailability = async () => {
  try {
    await api.get('/health', { timeout: 5000 });
    apiBlockEmitter.unblock();

    // Перезагружаем приложение после восстановления соединения
    try {
      if (__DEV__) {
        // В DEV режиме используем DevSettings
        const DevSettings = require('react-native').DevSettings;
        DevSettings.reload();
      } else {
        // В production используем expo-updates
        await Updates.reloadAsync();
      }
    } catch (_reloadError) {
      // Если перезагрузка не удалась, просто разблокируем
    }

    return true;
  } catch (error) {
    if (error.message === 'Network Error') {
      apiBlockEmitter.block();
    }
    return false;
  }
};

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
    });
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

  removeReaction: async (commentId, emoji) => {
    const response = await api.delete(`/timesheet/comment/${commentId}/reaction`, {
      data: { emoji },
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
    });
    return response.data;
  },

  addMessage: async (chatId, message, replyToId = null, mediaArray = []) => {
    // Если есть медиа, используем FormData
    if (mediaArray && mediaArray.length > 0) {
      const formData = new FormData();
      formData.append('chat_id', chatId);
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
    });
    return response.data;
  },

  updateMessage: async (id, message) => {
    const response = await api.put(`/messenger/message/${id}`, { message });
    return response.data;
  },

  removeMessage: async (id) => {
    const response = await api.delete(`/messenger/message/${id}`);
    return response.data;
  },

  addReaction: async (messageId, emoji) => {
    const response = await api.post('/messenger/message/reaction', {
      message_id: messageId,
      emoji,
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
    const response = await api.get('/messenger/calls/history');
    return response.data;
  },

  // Регистрация Expo Push Token
  registerPushToken: async (token) => {
    const response = await api.post('/messenger/calls/push-token', { token });
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
