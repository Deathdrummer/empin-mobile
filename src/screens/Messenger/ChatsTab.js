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
import { timesheetAPI } from '../../services/api';
import { formatShortName } from '../../utils/formatName';
import { CallButton } from '../../components/messenger/CallButton';
import { useCallContext } from '../../contexts/CallContext';

export default function ChatsTab() {
  const navigation = useNavigation();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const { initiateCall } = useCallContext();

  const loadStaff = useCallback(async () => {
    try {
      const data = await timesheetAPI.getAllStaff();
      setStaff(data);
    } catch (error) {
      console.error('Failed to load staff:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadStaff();
  }, [loadStaff]);

  const handleOpenChat = (item) => {
    navigation.navigate('Chat', {
      staffId: item.id,
      staffName: formatShortName(item),
    });
  };

  const handleCallPress = useCallback((item) => {
    initiateCall(item.id, formatShortName(item));
  }, [initiateCall]);

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.item}
      onPress={() => handleOpenChat(item)}
      activeOpacity={0.5}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {item.sname?.charAt(0) || '?'}
        </Text>
      </View>
      <View style={styles.content}>
        <Text style={styles.name}>{formatShortName(item)}</Text>
      </View>
      <CallButton
        userId={item.id}
        onPress={() => handleCallPress(item)}
      />
      <View style={styles.separator} />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <FlatList
      data={staff}
      keyExtractor={(item) => String(item.id)}
      renderItem={renderItem}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      ListEmptyComponent={
        <View style={styles.centered}>
          <Text style={styles.emptyText}>Нет сотрудников</Text>
        </View>
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
    justifyContent: 'center',
  },
  name: {
    fontSize: 16,
    color: '#000',
  },
  separator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 0.5,
    backgroundColor: '#E5E5EA',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
});
