import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  findNodeHandle,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Avatar } from '../chat/Avatar';
import { callScreenActions } from '../../utils/callScreen';
import EmpinCallService from '../../../modules/empin-call-service';

// Экран звонка всегда тёмный, как в мессенджерах: фон в цветах иконки приложения
const CALL_BACKGROUND = ['#3A0B11', '#140709', '#0B0B0E'];
const DECLINE_COLOR = '#FF3B30';
const ACCEPT_COLOR = '#34C759';

/** Круглая кнопка экрана звонка с подписью */
const CallButton = ({ icon, iconSet = 'ion', label, color, active, onPress, accessibilityLabel }) => {
  const Icon = iconSet === 'material' ? MaterialIcons : Ionicons;
  return (
    <View style={styles.callButtonWrap}>
      <TouchableOpacity
        style={[
          styles.callButton,
          color ? { backgroundColor: color } : active && styles.callButtonActive,
        ]}
        onPress={onPress}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel || label}
        accessibilityState={active !== undefined ? { selected: !!active } : undefined}
      >
        <Icon name={icon} size={30} color={active && !color ? '#14151A' : '#FFFFFF'} />
      </TouchableOpacity>
      {label ? <Text style={styles.callButtonLabel} numberOfLines={1}>{label}</Text> : null}
    </View>
  );
};

/**
 * Форматирование времени звонка
 * @param {number} seconds - Секунды
 * @returns {string} Форматированное время (MM:SS)
 */
const formatDuration = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Модальное окно звонка
 */
export const CallModal = ({
  visible,
  callState,
  participant,
  onAccept,
  onReject,
  onEnd,
  onToggleMute,
  onToggleSpeaker,
}) => {
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(50));
  const overlayRef = useRef(null);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 50,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const getStatusText = () => {
    switch (callState.status) {
      case 'idle':
      case 'initiating':
        return 'Звоним...';
      case 'ringing':
        return callState.callData?.isIncoming ? 'Входящий звонок' : 'Ожидание ответа...';
      case 'active':
        return 'Разговор';
      case 'ended':
        return 'Звонок завершён';
      case 'no_answer':
        return 'Нет ответа';
      case 'rejected':
        return 'Звонок отклонён';
      case 'error':
        return `Ошибка: ${callState.error || 'Неизвестная ошибка'}`;
      default:
        return '';
    }
  };

  const renderActionButtons = () => {
    const actions = callScreenActions(callState.status, callState.callData?.isIncoming);

    if (actions === 'incoming') {
      return (
        <View style={styles.actionsRow}>
          <CallButton icon="call-end" iconSet="material" label="Отклонить" color={DECLINE_COLOR} onPress={onReject} />
          <CallButton icon="call" iconSet="material" label="Принять" color={ACCEPT_COLOR} onPress={onAccept} />
        </View>
      );
    }

    if (actions === 'talk') {
      return (
        <View style={styles.actionsRow}>
          <CallButton
            icon={callState.isMuted ? 'mic-off' : 'mic'}
            label={callState.isMuted ? 'Без звука' : 'Микрофон'}
            accessibilityLabel={callState.isMuted ? 'Включить микрофон' : 'Выключить микрофон'}
            active={callState.isMuted}
            onPress={onToggleMute}
          />
          <CallButton
            icon="volume-high"
            label="Динамик"
            accessibilityLabel={callState.isSpeakerOn ? 'Переключить на наушник' : 'Включить громкую связь'}
            active={callState.isSpeakerOn}
            onPress={onToggleSpeaker}
          />
          <CallButton icon="call-end" iconSet="material" label="Завершить" color={DECLINE_COLOR} onPress={onEnd} />
        </View>
      );
    }

    if (actions === 'outgoing') {
      return (
        <View style={styles.actionsRow}>
          <CallButton icon="call-end" iconSet="material" label="Отменить" color={DECLINE_COLOR} onPress={onEnd} />
        </View>
      );
    }

    return null;
  };

  if (!visible) return null;

  const nameParts = (participant?.name || '').trim().split(/\s+/);
  const person = { sname: nameParts[0], fname: nameParts[1] };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      statusBarTranslucent={true}
    >
      {/* Своя «безопасная зона»: у содержимого Modal на iOS отдельная иерархия видов, и без провайдера внутри
          SafeAreaView получал нулевые отступы — шапка уезжала под строку состояния (на значок батареи) */}
      <SafeAreaProvider>
        <Animated.View
          ref={overlayRef}
          style={[styles.overlay, { opacity: fadeAnim }]}
          onLayout={() => EmpinCallService?.setDarkNavigationBar(findNodeHandle(overlayRef.current)).catch(() => {})}
        >
          <LinearGradient colors={CALL_BACKGROUND} style={StyleSheet.absoluteFill} />
          <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Аудиозвонок</Text>
            </View>

            <Animated.View style={[styles.center, { transform: [{ translateY: slideAnim }] }]}>
              {/* Avatar */}
              <View style={styles.avatarRing}>
                {/* Фото сотрудника (если есть) или инициалы */}
                <Avatar person={{ ...person, avatar: participant?.avatar }} id={participant?.id} size={128} />
              </View>

              {/* Name */}
              <Text style={styles.participantName} numberOfLines={2}>{participant?.name || 'Неизвестный'}</Text>

              {/* Status / Duration */}
              {callState.status === 'active' ? (
                <Text style={styles.durationText}>
                  {formatDuration(callState.duration)}
                </Text>
              ) : (
                <Text style={styles.statusText}>{getStatusText()}</Text>
              )}
            </Animated.View>

            {/* Action Buttons */}
            <View style={styles.actionsContainer}>{renderActionButtons()}</View>
          </SafeAreaView>
        </Animated.View>
      </SafeAreaProvider>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#0B0B0E',
  },
  safe: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.7)',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  avatarRing: {
    padding: 6,
    borderRadius: 76,
    borderWidth: 2,
    borderColor: 'rgba(255, 59, 66, 0.45)',
    marginBottom: 24,
  },
  participantName: {
    fontSize: 30,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  statusText: {
    fontSize: 17,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
  },
  durationText: {
    fontSize: 20,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.85)',
    fontVariant: ['tabular-nums'],
  },
  actionsContainer: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    minHeight: 140,
    justifyContent: 'flex-end',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'flex-start',
  },
  callButtonWrap: {
    alignItems: 'center',
    width: 96,
  },
  callButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
  callButtonActive: {
    backgroundColor: '#FFFFFF',
  },
  callButtonLabel: {
    marginTop: 8,
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.85)',
  },
});
