/**
 * EventEmitter для управления блокировкой приложения при недоступности API
 */
class ApiBlockEmitter {
  constructor() {
    this.listeners = [];
  }

  /**
   * Подписаться на события блокировки API
   * @param {Function} callback - Функция, которая будет вызвана при изменении состояния (true - заблокировано, false - разблокировано)
   * @returns {Function} Функция для отписки
   */
  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((listener) => listener !== callback);
    };
  }

  /**
   * Заблокировать приложение (API недоступен)
   */
  block() {
    this.listeners.forEach((listener) => listener(true));
  }

  /**
   * Разблокировать приложение (API доступен)
   */
  unblock() {
    this.listeners.forEach((listener) => listener(false));
  }
}

export default new ApiBlockEmitter();
