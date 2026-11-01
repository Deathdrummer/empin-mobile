// Одна отправка за раз; временная ошибка сети не оставляет устройство без входящих до нового входа.
export const createDeviceRegistration = ({
  getToken, sendToken, onState = (_state, _details = {}) => {},
  retryDelayMs = 1000, maxDelayMs = 30000,
}) => {
  let disposed = false;
  let inFlight = null;
  let timer = null;
  let registered = null;
  let failures = 0;
  let rerun = false;
  const controller = new AbortController();
  const schedule = () => {
    if (disposed || timer) return;
    const delay = Math.min(maxDelayMs, retryDelayMs * 2 ** Math.min(failures++, 5));
    timer = setTimeout(() => { timer = null; sync(); }, delay);
  };
  const run = async (force) => {
    try {
      const token = await getToken();
      if (disposed) return;
      if (!token) {
        registered = null;
        onState('waiting');
        schedule();
        return;
      }
      if (registered === token && !force) return;
      onState('registering');
      await sendToken(token, controller.signal);
      if (disposed) return;
      registered = token;
      failures = 0;
      onState('ready');
    } catch (error) {
      if (disposed) return;
      const status = error?.response?.status;
      onState('error', { status });
      // Нет сессии/прав или неверный запрос: не зацикливаем запросы. Возврат в приложение
      // попробует снова; временные сбои и отсутствие APNs-токена повторяем с паузой.
      if (!status || status >= 500 || status === 429) schedule();
    }
  };
  const sync = (force = false) => {
    if (disposed) return Promise.resolve();
    if (inFlight) { rerun = true; return inFlight; }
    clearTimeout(timer);
    timer = null;
    inFlight = run(force).finally(() => {
      inFlight = null;
      if (rerun && !disposed) { rerun = false; sync(true); }
    });
    return inFlight;
  };
  return {
    sync,
    dispose: () => { disposed = true; clearTimeout(timer); controller.abort(); },
  };
};
