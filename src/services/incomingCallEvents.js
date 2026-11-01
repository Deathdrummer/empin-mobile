// Push/WebSocket могут прийти повторно или в обратном порядке. Окончание конкретного
// вызова сохраняется на несколько минут, чтобы поздний incoming не воскресил его.
export const createIncomingCallEvents = ({ now = Date.now, retentionMs = 300000, limit = 128 } = {}) => {
  const ended = new Map();
  const prune = () => {
    const cutoff = now() - retentionMs;
    for (const [id, time] of ended) if (time <= cutoff) ended.delete(id);
    while (ended.size > limit) ended.delete(ended.keys().next().value);
  };
  return {
    finish: (callId) => {
      if (callId == null) return;
      ended.set(String(callId), now());
      prune();
    },
    canPresent: (callId, expiresAt) => {
      prune();
      if (!/^\d+$/.test(String(callId))) return false;
      if (ended.has(String(callId))) return false;
      const expiry = Number(expiresAt);
      return !Number.isFinite(expiry) || expiry <= 0 || expiry * 1000 > now();
    },
  };
};

export const incomingCallEvents = createIncomingCallEvents();

// Нативная кнопка относится к своему callUUID, а не к последнему push из хранилища.
export const selectIncomingCall = (eventCallId, storedCall, foregroundCall) => {
  const candidates = [storedCall, foregroundCall].filter((call) => call?.callId != null);
  return eventCallId == null ? candidates[0] ?? null
    : candidates.find((call) => String(call.callId) === String(eventCallId)) ?? null;
};

// После холодного запуска данные push могут уже исчезнуть, но системная кнопка
// содержит серверный ID. Актуальность и право принять окончательно проверяет accept API.
export const resolveNativeAnswer = (eventCallId, storedCall, foregroundCall, canPresent) => {
  const local = selectIncomingCall(eventCallId, storedCall, foregroundCall);
  if (local) return canPresent(local.callId, local.expiresAt) ? local : null;
  const id = String(eventCallId ?? '');
  return /^[1-9]\d{0,14}$/.test(id) && canPresent(id)
    ? { callId: id, callType: 'audio' } : null;
};

export const participantFromCaller = (caller) => {
  const id = Number(caller?.id);
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  const name = ['sname', 'fname', 'mname'].map((key) => typeof caller[key] === 'string' ? caller[key] : '').filter(Boolean).join(' ').trim();
  return { id, name: name || 'Собеседник', avatar: caller.avatar };
};
