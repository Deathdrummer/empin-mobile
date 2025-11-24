import { useState, useEffect } from 'react';
import { getPermissions, refreshPermissions } from '../utils/permissions';
import permissionsEmitter from '../utils/permissionsEmitter';

/**
 * React Hook для работы с правами пользователя
 * @returns {{
 *   permissions: string[],
 *   loading: boolean,
 *   can: (permission: string) => boolean,
 *   canAny: (permissionsList: string[]) => boolean,
 *   canAll: (permissionsList: string[]) => boolean,
 *   refresh: () => Promise<void>
 * }}
 */
export const usePermissions = () => {
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadPermissions = async () => {
    setLoading(true);
    try {
      const perms = await getPermissions();
      setPermissions(perms);
    } catch (error) {
      console.error('Error loading permissions:', error);
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  };

  // Начальная загрузка прав
  useEffect(() => {
    loadPermissions();
  }, []);

  // Подписка на события изменения прав
  useEffect(() => {
    const handlePermissionsUpdate = (newPermissions) => {
      setPermissions(newPermissions);
    };

    // Подписываемся на события
    const unsubscribe = permissionsEmitter.subscribe(handlePermissionsUpdate);

    // Отписываемся при размонтировании компонента
    return unsubscribe;
  }, []);

  /**
   * Проверить наличие права
   * @param {string} permission - Название права
   * @returns {boolean}
   */
  const can = (permission) => {
    return permissions.includes(permission);
  };

  /**
   * Проверить наличие хотя бы одного из прав
   * @param {string[]} permissionsList - Массив названий прав
   * @returns {boolean}
   */
  const canAny = (permissionsList) => {
    return permissionsList.some((p) => permissions.includes(p));
  };

  /**
   * Проверить наличие всех прав
   * @param {string[]} permissionsList - Массив названий прав
   * @returns {boolean}
   */
  const canAll = (permissionsList) => {
    return permissionsList.every((p) => permissions.includes(p));
  };

  /**
   * Обновить права с сервера
   * Вызывает /auth/me и автоматически обновляет все компоненты
   * @returns {Promise<void>}
   */
  const refresh = async () => {
    setLoading(true);
    try {
      await refreshPermissions();
      // refreshPermissions уже обновит права через EventEmitter
    } catch (error) {
      console.error('Error refreshing permissions:', error);
    } finally {
      setLoading(false);
    }
  };

  return {
    permissions,
    loading,
    can,
    canAny,
    canAll,
    refresh,
  };
};
