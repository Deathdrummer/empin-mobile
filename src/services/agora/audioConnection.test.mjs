import test from 'node:test';
import assert from 'node:assert/strict';
import { connectAudio } from './audioConnection.js';

const setup = (overrides = {}) => {
  const events = [];
  const handlers = [];
  const engine = {
    initialize: () => 0, enableAudio: () => 0, setAudioProfile: () => 0,
    setDefaultAudioRouteToSpeakerphone: () => 0, joinChannel: () => 0,
    registerEventHandler: (handler) => handlers.push(handler), unregisterEventHandler: () => {},
    ...overrides,
  };
  const open = (options = {}) => connectAudio({
    engine, appId: 'a'.repeat(32), token: 'test-token', channelName: 'test-call', uid: 35,
    sdk: { communication: 0, broadcaster: 1, audioProfile: 0, audioScenario: 0, failedState: 5, connectedState: 3, reconnectingState: 4, audioFailedState: 3, noAudioPermission: 2 },
    onConnected: () => events.push('connected'), onOffline: () => events.push('offline'),
    onFailure: (message, code) => events.push({ message, code }), ...options,
  });
  return { open, events, handlers, engine };
};

test('диагностика различает публикацию микрофона, подписку, аудио и уход участника', () => {
  const x = setup();
  const diagnostics = [];
  const session = x.open({ onDiagnostic: (event, details) => diagnostics.push({ event, details }) });
  try {
    const handler = x.handlers[0];
    handler.onFirstLocalAudioFramePublished({}, 300);
    handler.onAudioSubscribeStateChanged('private-channel', 55, 1, 3, 40);
    handler.onRemoteAudioStateChanged({}, 55, 2, 0);
    handler.onUserOffline({}, 55, 1);
    assert.deepEqual(diagnostics, [
      { event: 'first-local-audio', details: { elapsed: 300 } },
      { event: 'audio-subscription', details: { uid: 55, state: 3, elapsed: 40 } },
      { event: 'remote-audio', details: { uid: 55, state: 2, reason: 0 } },
      { event: 'peer-offline', details: { uid: 55, reason: 1 } },
    ]);
    assert.equal(JSON.stringify(diagnostics).includes('private-channel'), false);
    session.dispose();
    handler.onRemoteAudioStateChanged({}, 55, 3, 4);
    assert.equal(diagnostics.length, 4);
  } finally { session.dispose(); }
});

test('ответ API и успешная команда join не означают голосовое соединение', () => {
  const x = setup();
  const session = x.open();
  try {
    session.peerAccepted();
    assert.deepEqual(x.events, []);
    x.handlers[0].onJoinChannelSuccess({}, 1);
    assert.deepEqual(x.events, []);
    x.handlers[0].onUserJoined({}, 55, 1);
    assert.deepEqual(x.events, ['connected']);
    x.handlers[0].onUserJoined({}, 55, 1);
    assert.deepEqual(x.events, ['connected']);
  } finally { session.dispose(); }
});

test('обратный порядок SDK-событий: ждём локального подтверждения тоже', () => {
  const x = setup();
  const session = x.open();
  try {
    x.handlers[0].onUserJoined({}, 55, 1);
    assert.deepEqual(x.events, []);
    x.handlers[0].onJoinChannelSuccess({}, 1);
    assert.deepEqual(x.events, ['connected']);
  } finally { session.dispose(); }
});

test('SDK отклонил initialize или join: ошибка не проглатывается', () => {
  for (const method of ['initialize', 'enableAudio', 'setAudioProfile', 'joinChannel']) {
    const x = setup({ [method]: () => -7 });
    assert.throws(() => x.open(), new RegExp(`${method} \\(-7\\)`));
    for (const handler of x.handlers) handler.onUserJoined({}, 55, 1);
    assert.deepEqual(x.events, []);
  }
});

test('отмена защищает новый звонок от запоздавших событий старого', () => {
  const x = setup();
  const old = x.open();
  old.dispose();
  const current = x.open();
  try {
    x.handlers[0].onUserJoined({}, 55, 1);
    x.handlers[0].onUserOffline({}, 55, 0);
    x.handlers[0].onConnectionStateChanged({}, 5, 8);
    assert.deepEqual(x.events, []);
    x.handlers[1].onJoinChannelSuccess({}, 1);
    x.handlers[1].onUserJoined({}, 55, 1);
    assert.deepEqual(x.events, ['connected']);
  } finally { current.dispose(); }
});

test('нет SDK-подтверждения — ограниченный таймаут, а не вечный разговор', async () => {
  const x = setup();
  const session = x.open({ timeoutMs: 10 });
  try {
    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.equal(x.events.length, 1);
    assert.match(x.events[0].message, /Проверьте сеть/);
    x.handlers[0].onUserJoined({}, 55, 1);
    assert.equal(x.events.length, 1);
  } finally { session.dispose(); }
});

test('приняли вызов, но второй участник не вошёл — отдельная ошибка соединения', async () => {
  const x = setup();
  const session = x.open({ timeoutMs: 10 });
  try {
    x.handlers[0].onJoinChannelSuccess({}, 1);
    session.peerAccepted();
    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.equal(x.events.length, 1);
    assert.match(x.events[0].message, /Собеседник ответил/);
  } finally { session.dispose(); }
});

test('токен отклонён или микрофон запрещён — один сбой без выдачи параметров', () => {
  for (const error of [101, 109, 110]) {
    const x = setup();
    const session = x.open();
    try {
      x.handlers[0].onError(error, 'sensitive-token');
      x.handlers[0].onConnectionStateChanged({}, 5, 8);
      assert.equal(x.events.length, 1);
      assert.equal(x.events[0].code, error);
      assert.equal(x.events[0].message.includes('sensitive-token'), false);
    } finally { session.dispose(); }
  }
  const x = setup();
  const session = x.open();
  try {
    x.handlers[0].onLocalAudioStateChanged({}, 3, 2);
    assert.match(x.events[0].message, /Нет доступа к микрофону/);
  } finally { session.dispose(); }
});

test('короткий сетевой сбой восстанавливается, постоянный обрыв завершает соединение', async () => {
  for (const recover of [true, false]) {
    const x = setup();
    const session = x.open({ timeoutMs: 10 });
    try {
      x.handlers[0].onJoinChannelSuccess({}, 1);
      x.handlers[0].onUserJoined({}, 55, 1);
      x.handlers[0].onConnectionStateChanged({}, 4, 2);
      if (recover) x.handlers[0].onConnectionStateChanged({}, 3, 1);
      await new Promise((resolve) => setTimeout(resolve, 30));
      assert.equal(x.events.length, recover ? 1 : 2);
      if (!recover) assert.match(x.events[1].message, /Связь во время звонка потеряна/);
    } finally { session.dispose(); }
  }
});
