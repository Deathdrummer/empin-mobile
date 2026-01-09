/**
 * EventEmitter для прав пользователя
 * Позволяет компонентам подписываться на изменения прав и получать обновления в реальном времени
 */
class PermissionsEmitter {
  constructor() {
    this.listeners = [];
  }

  /**
   * Подписаться на изменения прав
   * @param {Function} callback - Функция, которая будет вызвана при изменении прав
   * @returns {Function} Функция для отписки
   */
  subscribe(callback) {
    this.listeners.push(callback);

    // Возвращаем функцию для отписки
    return () => {
      this.unsubscribe(callback);
    };
  }

  /**
   * Отписаться от изменений прав
   * @param {Function} callback - Функция, которую нужно удалить из подписчиков
   */
  unsubscribe(callback) {
    this.listeners = this.listeners.filter(listener => listener !== callback);
  }

  /**
   * Сообщить всем подписчикам об изменении прав
   * @param {string[]} permissions - Новый массив прав
   */
  emit(permissions) {
    this.listeners.forEach(listener => {
      try {
        listener(permissions);
      } catch (error) {
        console.error('Error in permissions listener', { error: error.message });
      }
    });
  }

  /**
   * Получить количество активных подписчиков
   * @returns {number}
   */
  getListenersCount() {
    return this.listeners.length;
  }
}

// Создаем единственный экземпляр (singleton)
const permissionsEmitter = new PermissionsEmitter();

export default permissionsEmitter;
