import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import permissionsEmitter from '../utils/permissionsEmitter';

const API_BASE_URL = 'https://empin-pro.ru/api'; // Production
// const API_BASE_URL = 'http://192.168.0.102/api'; // Local development

// Создаем экземпляр axios
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

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

// Перехватчик ответов для обработки ошибок авторизации
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Удаляем невалидный токен
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('user');

      // Вызываем callback для принудительного выхода
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
    } catch (error) {
      // Игнорируем ошибки logout на сервере
      console.log('Logout error (ignored):', error);
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

  getFilterOptions: async () => {
    const response = await api.get('/timesheet/filter-options');
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

  addComment: async (timesheetContractId, message, replyToId = null) => {
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

export default api;
