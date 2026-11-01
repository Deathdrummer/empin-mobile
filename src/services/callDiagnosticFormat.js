export const CALL_CAUSES = Object.freeze({
  unknown: 0, userHangup: 1, userReject: 2, incomingTimeout: 3, ringingTimeout: 4,
  peerOffline: 5, rtcFailure: 6, initiateFailed: 7, acceptFailed: 8,
  remoteWs: 9, remotePush: 10, apiState: 11, callkitEnd: 12, callkitTimeout: 13,
  androidEnd: 14, logout: 15, unmount: 16, replaceChannel: 17, reset: 18,
  lateInitiate: 19, lateAccept: 20, answerUi: 21, answerAndroid: 22,
  answerCallkit: 23, permissionDenied: 30, busy: 31,
});

const FIELDS = ['state', 'reason', 'code', 'status', 'callId', 'uid', 'cause', 'attempt', 'elapsed', 'engine', 'session', 'seq'];
export const safeCallDiagnostic = (event, details = {}) => {
  if (typeof event !== 'string' || !/^[a-z][a-z0-9-]{0,63}$/.test(event)) return null;
  const safe = {};
  for (const key of FIELDS) {
    const value = details[key];
    if (typeof value !== 'number' && !(typeof value === 'string' && /^-?\d{1,16}$/.test(value))) continue;
    const number = Number(value);
    if (Number.isSafeInteger(number)) safe[key] = number;
  }
  return { event, ...safe };
};

export const readCallDiagnostics = (raw, limit = 400) => {
  let entries;
  try { entries = JSON.parse(raw ?? '[]'); } catch { return []; }
  if (!Array.isArray(entries)) return [];
  return entries.slice(-limit).flatMap((entry) => {
    if (!entry || typeof entry.time !== 'string' || !Number.isFinite(Date.parse(entry.time))) return [];
    const safe = safeCallDiagnostic(entry.event, entry);
    return safe ? [{ time: new Date(entry.time).toISOString(), ...safe }] : [];
  });
};
