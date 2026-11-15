import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  HOLD,
  holdAudioPlan,
  incomingDuringCall,
  isAudioInterrupted,
  isAudioRecovered,
  nextHoldReasons,
  peerOnHoldFromDetails,
} from './callHold.js';

test('причины удержания: без повторов, снимаются по одной', () => {
  let reasons = nextHoldReasons([], HOLD.system, true);
  reasons = nextHoldReasons(reasons, HOLD.system, true);
  assert.deepEqual(reasons, [HOLD.system]);
  reasons = nextHoldReasons(reasons, HOLD.interruption, true);
  assert.deepEqual(nextHoldReasons(reasons, HOLD.system, false), [HOLD.interruption]);
  assert.deepEqual(nextHoldReasons(undefined, HOLD.system, false), []);
});

test('удержание CallKit: звук глушится и выключается, возврат — включается, микрофон как был', () => {
  const hold = holdAudioPlan([], [HOLD.system]);
  assert.deepEqual(hold.steps, [['muteLocalAudioStream', true], ['muteAllRemoteAudioStreams', true], ['disableAudio']]);
  assert.equal(hold.changed, true);
  assert.equal(hold.held, true);

  // Человек сам выключил микрофон до удержания — после возврата он остаётся выключенным
  const resume = holdAudioPlan([HOLD.system], [], true);
  assert.deepEqual(resume.steps, [['enableAudio'], ['muteAllRemoteAudioStreams', false], ['muteLocalAudioStream', true]]);
  assert.equal(resume.changed, true);
});

test('прерывание звонком по сотовой связи: только глушим, захват не останавливаем', () => {
  const plan = holdAudioPlan([], [HOLD.interruption]);
  assert.deepEqual(plan.steps, [['muteLocalAudioStream', true], ['muteAllRemoteAudioStreams', true]]);
  assert.ok(!plan.steps.some(([step]) => step === 'disableAudio'));
});

test('вторая причина при уже удержанном звонке не меняет состояние для собеседника', () => {
  const plan = holdAudioPlan([HOLD.interruption], [HOLD.interruption, HOLD.system]);
  assert.deepEqual(plan.steps, [['disableAudio']]);
  assert.equal(plan.changed, false);
  const partly = holdAudioPlan([HOLD.interruption, HOLD.system], [HOLD.interruption]);
  assert.deepEqual(partly.steps, [['enableAudio']]);
  assert.equal(partly.held, true);
  assert.equal(partly.changed, false);
});

test('сигналы Agora: прерывание системным звонком и возврат захвата', () => {
  assert.equal(isAudioInterrupted(0, 8), true);
  assert.equal(isAudioInterrupted(3, 8), true);
  // Нет разрешения на микрофон — не удержание
  assert.equal(isAudioInterrupted(3, 2), false);
  // Мы сами выключили звук (удержание CallKit)
  assert.equal(isAudioInterrupted(0, 0), false);
  assert.equal(isAudioRecovered(1, 0), true);
  assert.equal(isAudioRecovered(2, 0), true);
  assert.equal(isAudioRecovered(3, 8), false);
});

test('входящий во время разговора ждёт ответа; при наборе, втором ожидающем или удержанном — «занято»', () => {
  assert.equal(incomingDuringCall({ status: 'idle', callId: 7 }), 'present');
  assert.equal(incomingDuringCall({ status: 'active', callId: 7 }), 'waiting');
  assert.equal(incomingDuringCall({ status: 'connecting', callId: 7 }), 'waiting');
  assert.equal(incomingDuringCall({ status: 'ringing', callId: 7 }), 'busy');
  assert.equal(incomingDuringCall({ status: 'active', waitingCallId: 5, callId: 7 }), 'busy');
  assert.equal(incomingDuringCall({ status: 'active', parkedCallId: 3, callId: 7 }), 'busy');
  // Удержанный есть, а разговор только что закончился (возвращаемся к удержанному) — тоже занято
  assert.equal(incomingDuringCall({ status: 'idle', parkedCallId: 3, callId: 7 }), 'busy');
  // Повтор push того же ожидающего
  assert.equal(incomingDuringCall({ status: 'active', waitingCallId: '7', callId: 7 }), 'duplicate');
});

test('удержание собеседника по сведениям сервера; старый сервер не сообщает', () => {
  assert.equal(peerOnHoldFromDetails({ call: { status: 'active' }, hold: { me: false, peer: true } }), true);
  assert.equal(peerOnHoldFromDetails({ call: { status: 'active' }, hold: { me: true, peer: false } }), false);
  assert.equal(peerOnHoldFromDetails({ call: { status: 'completed' }, hold: { peer: true } }), false);
  assert.equal(peerOnHoldFromDetails({ call: { status: 'active' } }), false);
});
