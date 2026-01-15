import AsyncStorage from '@react-native-async-storage/async-storage';
import { authAPI } from '../services/api';

/**
 * Получить все права пользователя из AsyncStorage
 * @returns {Promise<string[]>} Массив прав
 */
export const getPermissions = async () => {
  try {
    const permissionsJson = await AsyncStorage.getItem('permissions');
    return permissionsJson ? JSON.parse(permissionsJson) : [];
  } catch (error) {
    console.error('Error getting permissions', { error: error.message });
    return [];
  }
};

// Кэш для предотвращения множественных параллельных запросов
let refreshPromise = null;

/**
 * Обновить права пользователя с сервера
 * Вызывает /auth/me и автоматически обновляет права через EventEmitter
 * Если вызывается несколько раз параллельно - возвращает тот же Promise
 * @returns {Promise<string[]>} Новый массив прав
 */
export const refreshPermissions = async () => {
  // Если уже идёт запрос - возвращаем существующий Promise
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const userData = await authAPI.me();
      return userData.permissions || [];
    } catch (error) {
      console.error('Error refreshing permissions', { error: error.message });
      throw error;
    } finally {
      // Очищаем кэш после завершения запроса
      refreshPromise = null;
    }
  })();

  return refreshPromise;
};

/**
 * Проверить наличие права у пользователя
 * @param {string} permission - Название права (например, "contract-col-date_report_from:site")
 * @returns {Promise<boolean>} true если право есть, иначе false
 */
export const hasPermission = async (permission) => {
  const permissions = await getPermissions();
  return permissions.includes(permission);
};

/**
 * Проверить наличие хотя бы одного из прав
 * @param {string[]} permissionsList - Массив названий прав
 * @returns {Promise<boolean>} true если есть хотя бы одно право
 */
export const hasAnyPermission = async (permissionsList) => {
  const permissions = await getPermissions();
  return permissionsList.some((p) => permissions.includes(p));
};

/**
 * Проверить наличие всех прав
 * @param {string[]} permissionsList - Массив названий прав
 * @returns {Promise<boolean>} true если есть все права
 */
export const hasAllPermissions = async (permissionsList) => {
  const permissions = await getPermissions();
  return permissionsList.every((p) => permissions.includes(p));
};
