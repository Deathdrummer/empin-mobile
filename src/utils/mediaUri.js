import { SERVER_URL } from '../services/api';

/** Путь файла с сервера (/storage/…) — в полный адрес; локальные и полные адреса — как есть */
export const resolveMediaUri = (path) => {
  if (!path) return null;
  if (/^(https?|file|content|data|ph):/i.test(path)) return path;
  return `${SERVER_URL}${path.startsWith('/') ? '' : '/'}${path}`;
};
