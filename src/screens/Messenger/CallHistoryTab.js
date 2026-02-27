import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { messengerAPI } from '../../services/api';
import { formatShortName } from '../../utils/formatName';

/**
 * Форматирование длительности звонка
 */
const formatDuration = (seconds) => {
  if (!seconds || seconds === 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Форматирование времени звонка
 */
const formatTime = (timestamp) => {
  const date = new Date(timestamp);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
};

/**
 * Группировка по дате
 */
const groupByDate = (calls) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const groups = {
    today: [],
    yesterday: [],
    earlier: [],
  };

  calls.forEach((call) => {
    const callDate = new Date(call.created_at);
    callDate.setHours(0, 0, 0, 0);

    if (callDate.getTime() === today.getTime()) {
      groups.today.push(call);
    } else if (callDate.getTime() === yesterday.getTime()) {
      groups.yesterday.push(call);
    } else {
      groups.earlier.push(call);
    }
  });

  return groups;
};

/**
 * Элемент списка звонка
 */
const CallHistoryItem = ({ call, currentUserId, onPress }) => {
  const isOutgoing = call.caller_id === currentUserId;
  const otherParticipant = isOutgoing ? call.callee : call.caller;
  const participantName = otherParticipant
    ? (formatShortName(otherParticipant) !== 'Без имени'
        ? formatShortName(otherParticipant)
        : otherParticipant.full_name || 'Неизвестный')
    : 'Неизвестный';

  const getCallIcon = () => {
    if (call.status === 'missed') {
      return { name: 'phone-missed', color: '#EF4444' };
    } else if (call.status === 'rejected') {
      return { name: 'phone-disabled', color: '#EF4444' };
    } else if (isOutgoing) {
      return { name: 'phone-forwarded', color: '#3B82F6' };
    } else {
      return { name: 'phone-callback', color: '#10B981' };
    }
  };

  const getDurationText = () => {
    if (call.status === 'missed') return 'пропущен';
    if (call.status === 'rejected') return 'отклонён';
    if (call.status === 'completed' && call.duration) {
      return formatDuration(call.duration);
    }
    return 'не отвечен';
  };

  const icon = getCallIcon();

  return (
    <TouchableOpacity style={styles.item} onPress={onPress} activeOpacity={0.5}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {participantName.charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={styles.content}>
        <View style={styles.row}>
          <MaterialIcons name={icon.name} size={16} color={icon.color} />
          <Text style={styles.name}>{participantName}</Text>
        </View>
        <Text style={styles.time}>{formatTime(call.created_at)}</Text>
      </View>
      <Text style={styles.duration}>{getDurationText()}</Text>
      <View style={styles.separator} />
    </TouchableOpacity>
  );
};

/**
 * Заголовок секции
 */
const SectionHeader = ({ title }) => (
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionTitle}>{title}</Text>
  </View>
);

/**
 * Пустое состояние
 */
const EmptyState = () => (
  <View style={styles.emptyState}>
    <MaterialIcons name="phone" size={64} color="#D1D5DB" />
    <Text style={styles.emptyTitle}>История звонков пуста</Text>
    <Text style={styles.emptyText}>
      Позвоните кому-нибудь,{'\n'}
      чтобы увидеть историю здесь
    </Text>
  </View>
);

export default function CallHistoryTab() {
  const navigation = useNavigation();
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);

  useEffect(() => {
    const loadCurrentUser = async () => {
      try {
        const userJson = await AsyncStorage.getItem('user');
        if (userJson) {
          const user = JSON.parse(userJson);
          setCurrentUserId(user.staff_id);
        }
      } catch (error) {
        console.error('Failed to load current user in CallHistoryTab', error);
      }
    };
    loadCurrentUser();
  }, []);

  const loadCallHistory = useCallback(async () => {
    try {
      const data = await messengerAPI.getCallHistory();
      setCalls(data.calls || []);
    } catch (error) {
      console.error('Failed to load call history:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadCallHistory();
  }, [loadCallHistory]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadCallHistory();
  }, [loadCallHistory]);

  const handleItemPress = (call) => {
    const isOutgoing = call.caller_id === currentUserId;
    const otherParticipant = isOutgoing ? call.callee : call.caller;
    if (otherParticipant?.id) {
      const name = formatShortName(otherParticipant) !== 'Без имени'
        ? formatShortName(otherParticipant)
        : otherParticipant.full_name || 'Собеседник';
      navigation.navigate('Chat', {
        staffId: otherParticipant.id,
        staffName: name,
      });
    }
  };

  const renderItem = ({ item }) => (
    <CallHistoryItem call={item} currentUserId={currentUserId} onPress={() => handleItemPress(item)} />
  );

  const renderSectionList = () => {
    const groups = groupByDate(calls);
    const sections = [];

    if (groups.today.length > 0) {
      sections.push({ title: 'Сегодня', data: groups.today });
    }
    if (groups.yesterday.length > 0) {
      sections.push({ title: 'Вчера', data: groups.yesterday });
    }
    if (groups.earlier.length > 0) {
      sections.push({ title: 'Ранее', data: groups.earlier });
    }

    return sections.map((section, sectionIndex) => (
      <View key={sectionIndex}>
        <SectionHeader title={section.title} />
        {section.data.map((call, index) => (
          <CallHistoryItem
            key={call.id || index}
            call={call}
            currentUserId={currentUserId}
            onPress={() => handleItemPress(call)}
          />
        ))}
      </View>
    ));
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (calls.length === 0) {
    return <EmptyState />;
  }

  return (
    <FlatList
      data={[{ key: 'sections' }]}
      renderItem={() => renderSectionList()}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    />
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    flexGrow: 1,
  },
  item: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  name: {
    fontSize: 16,
    color: '#000',
    fontWeight: '500',
  },
  time: {
    fontSize: 14,
    color: '#6B7280',
  },
  duration: {
    fontSize: 14,
    color: '#6B7280',
  },
  separator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 0.5,
    backgroundColor: '#E5E5EA',
  },
  sectionHeader: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#F3F4F6',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
  },
});
