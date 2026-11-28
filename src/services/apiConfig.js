/**
 * Адрес API приложения. По умолчанию — новый сайт empin-pro.com (ERP empin-new): API там отдаётся
 * под /api с отрезанием префикса, а мобильные маршруты сервера сами начинаются с /api — отсюда
 * /api/api. Свой адрес — EXPO_PUBLIC_API_BASE_URL (локально http://10.0.2.2:3100/api).
 */
export const DEFAULT_API_BASE_URL = 'https://empin-pro.com/api/api';

export const apiBaseUrl = (fromEnv) => (fromEnv || DEFAULT_API_BASE_URL).replace(/\/+$/, '');

/** Сервер без /api мобильных маршрутов — для /broadcasting/auth и файлов /storage/… */
export const serverUrl = (apiBase) => apiBase.replace(/\/api$/, '');
