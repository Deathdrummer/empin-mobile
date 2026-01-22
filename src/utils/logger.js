import * as FileSystem from 'expo-file-system';

const LOG_FILE = FileSystem.documentDirectory + 'app.log';
const MAX_SIZE = 1024 * 1024 * 5; // 5MB

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };

class Logger {
  constructor() {
    this.currentLevel = __DEV__ ? LEVELS.debug : LEVELS.info;
  }

  async write(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    const line = `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}\n`;

    // Console
    if (__DEV__) {
      console[level === 'error' ? 'error' : 'log'](line.trim());
    }

    // Файл
    try {
      const info = await FileSystem.getInfoAsync(LOG_FILE);
      if (info.exists && info.size > MAX_SIZE) {
        await FileSystem.deleteAsync(LOG_FILE);
      }

      await FileSystem.writeAsStringAsync(LOG_FILE, line, {
        encoding: FileSystem.EncodingType.UTF8,
        append: true
      });
    } catch (error) {
      console.error('Failed to write log:', error);
    }
  }

  error(msg, meta) {
    if (LEVELS.error <= this.currentLevel) this.write('error', msg, meta);
  }

  warn(msg, meta) {
    if (LEVELS.warn <= this.currentLevel) this.write('warn', msg, meta);
  }

  info(msg, meta) {
    if (LEVELS.info <= this.currentLevel) this.write('info', msg, meta);
  }

  debug(msg, meta) {
    if (LEVELS.debug <= this.currentLevel) this.write('debug', msg, meta);
  }

  async getLogs() {
    try {
      return await FileSystem.readAsStringAsync(LOG_FILE, {
        encoding: FileSystem.EncodingType.UTF8
      });
    } catch {
      return '';
    }
  }

  async clearLogs() {
    try {
      await FileSystem.deleteAsync(LOG_FILE);
    } catch {}
  }
}

export default new Logger();
