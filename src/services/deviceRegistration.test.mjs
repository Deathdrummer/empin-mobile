import test from 'node:test';
import assert from 'node:assert/strict';
import { createDeviceRegistration } from './deviceRegistration.js';

test('временный сбой регистрации исправляется без повторного входа', async () => {
  let sent = 0;
  const states = [];
  let ready;
  const done = new Promise((resolve) => { ready = resolve; });
  const registration = createDeviceRegistration({
    getToken: async () => 'device-token', retryDelayMs: 1,
    sendToken: async () => { if (++sent === 1) throw new Error('offline'); },
    onState: (state) => { states.push(state); if (state === 'ready') ready(); },
  });
  try {
    await registration.sync();
    await done;
    assert.equal(sent, 2);
    assert.deepEqual(states, ['registering', 'error', 'registering', 'ready']);
  } finally { registration.dispose(); }
});

test('APNs-токен появился позже запуска — всё равно регистрируется', async () => {
  let reads = 0;
  const sent = [];
  const registration = createDeviceRegistration({ getToken: async () => ++reads > 1 ? 'apns' : null,
    sendToken: async (token) => sent.push(token), retryDelayMs: 10000 });
  try {
    await registration.sync();
    assert.deepEqual(sent, []);
    await registration.sync();
    assert.deepEqual(sent, ['apns']);
  } finally { registration.dispose(); }
});

test('смена токена во время отправки не теряется, отправки не параллельные', async () => {
  let token = 'old';
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const sent = [];
  let ready;
  const done = new Promise((resolve) => { ready = resolve; });
  const registration = createDeviceRegistration({ getToken: async () => token,
    sendToken: async (value) => { sent.push(value); if (value === 'old') await gate; else ready(); } });
  try {
    const first = registration.sync();
    await new Promise((resolve) => setImmediate(resolve));
    token = 'new';
    registration.sync();
    assert.deepEqual(sent, ['old']);
    release();
    await first;
    await done;
    assert.deepEqual(sent, ['old', 'new']);
  } finally { registration.dispose(); }
});

test('выход из аккаунта отменяет отправку и повторы', async () => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  let sent = 0;
  const registration = createDeviceRegistration({ getToken: async () => { await gate; return 'token'; },
    sendToken: async () => sent++ });
  const work = registration.sync();
  registration.dispose();
  release();
  await work;
  await registration.sync();
  assert.equal(sent, 0);
});
