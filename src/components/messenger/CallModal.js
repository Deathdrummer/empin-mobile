import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Animated,
} from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

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

  // Авто-закрытие при статусе 'ended'
  useEffect(() => {
    if (callState.status === 'ended') {
      const timer = setTimeout(() => {
        // Modal закроется автоматически через 2 секунды
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [callState.status]);

  const getStatusText = () => {
    switch (callState.status) {
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
    if (callState.status === 'ringing' && callState.callData?.isIncoming) {
      // Входящий звонок
      return (
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.actionButton, styles.rejectButton]}
            onPress={onReject}
            activeOpacity={0.8}
          >
            <MaterialIcons name="call-end" size={32} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.acceptButton]}
            onPress={onAccept}
            activeOpacity={0.8}
          >
            <MaterialIcons name="call" size={32} color="#fff" />
          </TouchableOpacity>
        </View>
      );
    }

    if (callState.status === 'active') {
      // Активный звонок
      return (
        <View style={styles.actionsGrid}>
          <TouchableOpacity
            style={[
              styles.controlButton,
              callState.isMuted && styles.controlButtonActive,
            ]}
            onPress={onToggleMute}
            activeOpacity={0.8}
          >
            <MaterialIcons
              name={callState.isMuted ? 'mic-off' : 'mic'}
              size={28}
              color={callState.isMuted ? '#3B82F6' : '#6B7280'}
            />
            <Text style={styles.controlButtonText}>
              {callState.isMuted ? 'Вкл. микрофон' : 'Выкл. микрофон'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.controlButton,
              callState.isSpeakerOn && styles.controlButtonActive,
            ]}
            onPress={onToggleSpeaker}
            activeOpacity={0.8}
          >
            <MaterialIcons
              name={callState.isSpeakerOn ? 'volume-up' : 'volume-down'}
              size={28}
              color={callState.isSpeakerOn ? '#3B82F6' : '#6B7280'}
            />
            <Text style={styles.controlButtonText}>
              {callState.isSpeakerOn ? 'Динамик' : 'Наушники'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.endButton]}
            onPress={onEnd}
            activeOpacity={0.8}
          >
            <MaterialIcons name="call-end" size={32} color="#fff" />
          </TouchableOpacity>
        </View>
      );
    }

    if (callState.status === 'initiating' || callState.status === 'ringing') {
      // Исходящий звонок
      return (
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.actionButton, styles.endButton]}
            onPress={onEnd}
            activeOpacity={0.8}
          >
            <MaterialIcons name="call-end" size={32} color="#fff" />
          </TouchableOpacity>
        </View>
      );
    }

    if (['error', 'ended', 'no_answer', 'rejected'].includes(callState.status)) {
      return null;
    }

    return null;
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      statusBarTranslucent={true}
    >
      <BlurView intensity={50} style={styles.overlay}>
        <Animated.View
          style={[
            styles.container,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerSpacer} />
            <Text style={styles.headerTitle}>Звонок</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onEnd || onReject}
              activeOpacity={0.6}
            >
              <MaterialIcons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Avatar */}
          <View style={styles.avatarContainer}>
            {participant?.avatar ? (
              <Image
                source={{ uri: participant.avatar }}
                style={styles.avatar}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <MaterialCommunityIcons
                  name="account"
                  size={64}
                  color="#9CA3AF"
                />
              </View>
            )}
          </View>

          {/* Name */}
          <Text style={styles.participantName}>{participant?.name || 'Неизвестный'}</Text>

          {/* Status */}
          <Text style={styles.statusText}>{getStatusText()}</Text>

          {/* Duration Timer */}
          {callState.status === 'active' && (
            <Text style={styles.durationText}>
              {formatDuration(callState.duration)}
            </Text>
          )}

          {/* Action Buttons */}
          <View style={styles.actionsContainer}>{renderActionButtons()}</View>
        </Animated.View>
      </BlurView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  container: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    alignItems: 'center',
  },
  header: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  headerSpacer: {
    width: 24,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  closeButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  participantName: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  statusText: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 8,
  },
  durationText: {
    fontSize: 20,
    fontWeight: '500',
    color: '#3B82F6',
    marginBottom: 16,
  },
  actionsContainer: {
    width: '100%',
    marginTop: 16,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
  },
  actionsGrid: {
    width: '100%',
    gap: 16,
  },
  actionButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptButton: {
    backgroundColor: '#10B981',
  },
  rejectButton: {
    backgroundColor: '#EF4444',
  },
  endButton: {
    backgroundColor: '#EF4444',
    alignSelf: 'center',
  },
  controlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    gap: 8,
  },
  controlButtonActive: {
    backgroundColor: '#DBEAFE',
  },
  controlButtonText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
});
