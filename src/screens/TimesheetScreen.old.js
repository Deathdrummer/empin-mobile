import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  Alert,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import CalendarPicker from 'react-native-calendar-picker';
import { timesheetAPI, authAPI } from '../services/api';
import BottomMenu from '../components/BottomMenu';
import { Can } from '../components/Can';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { refreshPermissions, hasPermission } from '../utils/permissions';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function TimesheetScreen({ onLogout }) {
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef(null);

  // Диапазон загруженных дней - загружаем сразу большой диапазон
  const DAYS_RANGE = 30; // 30 дней назад и 30 дней вперед
  const LOAD_MORE_THRESHOLD = 15; // Подгружаем когда остается 15 дней до края
  const [minIndex, setMinIndex] = useState(-DAYS_RANGE);
  const [maxIndex, setMaxIndex] = useState(DAYS_RANGE);
  const [loadingMore, setLoadingMore] = useState(false);

  // Модальное окно выбора сотрудника
  const [staffModalVisible, setStaffModalVisible] = useState(false);
  const [staffList, setStaffList] = useState([]);
  const [selectedDay, setSelectedDay] = useState(null);

  // Модальное окно поиска договора
  const [contractModalVisible, setContractModalVisible] = useState(false);
  const [contractSearch, setContractSearch] = useState('');
  const [contractsList, setContractsList] = useState([]);
  const [selectedTeamId, setSelectedTeamId] = useState(null);

  // Раскрытие чата
  const [expandedContract, setExpandedContract] = useState(null);
  const [commentText, setCommentText] = useState('');

  // Модальное окно подтверждения выхода
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);

  // Модальное окно календаря
  const [calendarModalVisible, setCalendarModalVisible] = useState(false);


  useEffect(() => {
    // Обновляем права при монтировании экрана
    refreshPermissions().catch(err => {
      console.error('Failed to refresh permissions on mount:', err);
    });
    // Загружаем данные
    loadDays();
  }, []);

  const loadDays = async (min = -DAYS_RANGE, max = DAYS_RANGE, preserveScrollPosition = false) => {
    try {
      const indexes = [];
      for (let i = min; i <= max; i++) {
        indexes.push(i);
      }

      const data = await timesheetAPI.getSlides(indexes);

      if (data && Array.isArray(data)) {
        // Сохраняем текущий день перед обновлением
        const currentDayIndex = preserveScrollPosition && days.length > 0 && days[currentIndex]
          ? days[currentIndex].index
          : null;

        setDays(data);
        setMinIndex(min);
        setMaxIndex(max);

        // Восстанавливаем позицию скролла
        if (preserveScrollPosition && currentDayIndex !== null) {
          const newIdx = data.findIndex(day => day.index === currentDayIndex);
          if (newIdx !== -1) {
            setCurrentIndex(newIdx);
            // Прокручиваем к сохраненной позиции
            setTimeout(() => {
              if (flatListRef.current) {
                flatListRef.current.scrollToIndex({
                  index: newIdx,
                  animated: false,
                });
              }
            }, 50);
          }
        } else {
          // Находим индекс текущего дня (где index = 0)
          const todayIdx = data.findIndex(day => day.index === 0);
          if (todayIdx !== -1) {
            setCurrentIndex(todayIdx);
            // Прокручиваем к текущему дню
            setTimeout(() => {
              if (flatListRef.current) {
                flatListRef.current.scrollToIndex({
                  index: todayIdx,
                  animated: false,
                });
              }
            }, 100);
          }
        }
      } else {
        Alert.alert('Ошибка', 'Неверный формат данных');
      }
    } catch (error) {

      // Если ошибка 401 - выходим из аккаунта без показа ошибки
      if (error.response?.status === 401) {
        Toast.show({
          type: 'error',
          text1: 'Сессия истекла',
          text2: 'Необходимо войти заново',
          position: 'top',
          visibilityTime: 2000,
        });
        setTimeout(() => {
          onLogout();
        }, 2000);
        return;
      }

      const errorMsg = error.response?.data?.message || error.message || 'Неизвестная ошибка';
      Toast.show({
        type: 'error',
        text1: 'Ошибка загрузки',
        text2: errorMsg,
        position: 'top',
        visibilityTime: 3000,
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      // Обновляем права с сервера
      await refreshPermissions();
      // Обновляем данные экрана
      await loadDays(minIndex, maxIndex, true);
    } catch (error) {
      console.error('Error refreshing data:', error);
    }
  };

  // Подгрузка следующих дней (вперед)
  const loadMoreForward = async () => {
    if (loadingMore) return;

    setLoadingMore(true);
    try {
      const newMaxIndex = maxIndex + DAYS_RANGE;
      const indexes = [];
      for (let i = maxIndex + 1; i <= newMaxIndex; i++) {
        indexes.push(i);
      }

      const newData = await timesheetAPI.getSlides(indexes);
      if (newData && Array.isArray(newData)) {
        setDays(prev => [...prev, ...newData]);
        setMaxIndex(newMaxIndex);
      }
    } catch (error) {
      console.error('Error loading more days:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  // Подгрузка предыдущих дней (назад)
  const loadMoreBackward = async () => {
    if (loadingMore) return;

    setLoadingMore(true);
    try {
      const newMinIndex = minIndex - DAYS_RANGE;
      const indexes = [];
      for (let i = newMinIndex; i < minIndex; i++) {
        indexes.push(i);
      }

      const newData = await timesheetAPI.getSlides(indexes);
      if (newData && Array.isArray(newData)) {
        // Сохраняем текущую позицию
        const currentDayIndex = days[currentIndex]?.index;

        // Добавляем новые дни в начало
        const updatedDays = [...newData, ...days];
        setDays(updatedDays);
        setMinIndex(newMinIndex);

        // Корректируем индекс текущего дня
        if (currentDayIndex !== null && currentDayIndex !== undefined) {
          const newIdx = updatedDays.findIndex(day => day.index === currentDayIndex);
          if (newIdx !== -1) {
            setCurrentIndex(newIdx);
            // Прокручиваем к сохраненной позиции
            setTimeout(() => {
              if (flatListRef.current) {
                flatListRef.current.scrollToIndex({
                  index: newIdx,
                  animated: false,
                });
              }
            }, 50);
          }
        }
      }
    } catch (error) {
      console.error('Error loading previous days:', error);
    } finally {
      setLoadingMore(false);
    }
  };


  // Открыть модальное окно добавления бригады
  const openAddTeamModal = async (day) => {
    try {
      // СНАЧАЛА обновляем права с сервера
      const permissions = await refreshPermissions();

      // ПОТОМ проверяем актуальные права
      const canCreate = permissions.includes('mobile-app-can-create-team:site');

      if (!canCreate) {
        Toast.show({
          type: 'error',
          text1: 'Нет прав',
          text2: 'У вас нет прав для добавления бригады',
          position: 'top',
          visibilityTime: 3000,
        });
        return;
      }

      // Если права есть - открываем модалку
      setSelectedDay(day);
      const staff = await timesheetAPI.getStaff();
      setStaffList(staff);
      setStaffModalVisible(true);
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Ошибка',
        text2: error.message || 'Не удалось загрузить список сотрудников',
        position: 'top',
        visibilityTime: 3000,
      });
    }
  };

  // Добавить бригаду
  const handleAddTeam = async (staffId, staffName) => {
    try {
      await timesheetAPI.addTeam(staffId, selectedDay.day);
      setStaffModalVisible(false);
      Toast.show({
        type: 'success',
        text1: 'Успешно',
        text2: `Бригада "${staffName}" добавлена`,
        position: 'top',
        visibilityTime: 2000,
      });
      setTimeout(() => loadDays(minIndex, maxIndex, true), 300);
    } catch (error) {
      // Проверка на ошибку прав доступа
      if (error.response?.status === 403) {
        Toast.show({
          type: 'error',
          text1: 'Нет прав',
          text2: error.response?.data?.error || 'У вас нет прав для добавления бригады',
          position: 'top',
          visibilityTime: 3000,
        });
      } else {
        Toast.show({
          type: 'error',
          text1: 'Ошибка',
          text2: 'Не удалось добавить бригаду',
          position: 'top',
          visibilityTime: 3000,
        });
      }
    }
  };

  // Открыть модальное окно добавления договора
  const openAddContractModal = async (teamId) => {
    try {
      // СНАЧАЛА обновляем права с сервера
      const permissions = await refreshPermissions();

      // ПОТОМ проверяем актуальные права
      const canCreate = permissions.includes('mobile-app-can-create-contract:site');

      if (!canCreate) {
        Toast.show({
          type: 'error',
          text1: 'Нет прав',
          text2: 'У вас нет прав для добавления договора',
          position: 'top',
          visibilityTime: 3000,
        });
        return;
      }

      // Если права есть - открываем модалку
      setSelectedTeamId(teamId);
      setContractModalVisible(true);
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Ошибка',
        text2: 'Не удалось проверить права',
        position: 'top',
        visibilityTime: 3000,
      });
    }
  };

  // Поиск договоров
  const searchContracts = async (text) => {
    setContractSearch(text);
    if (text.length < 2) {
      setContractsList([]);
      return;
    }
    try {
      const contracts = await timesheetAPI.searchContracts(text);
      setContractsList(contracts);
    } catch (error) {
      // Игнорируем ошибки поиска
    }
  };

  // Добавить договор
  const handleAddContract = async (contractId) => {
    try {
      await timesheetAPI.addContract(contractId, selectedTeamId);
      setContractModalVisible(false);
      setContractSearch('');
      setContractsList([]);
      Toast.show({
        type: 'success',
        text1: 'Успешно',
        text2: 'Договор добавлен',
        position: 'top',
        visibilityTime: 2000,
      });
      setTimeout(() => loadDays(minIndex, maxIndex, true), 300);
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Ошибка',
        text2: 'Не удалось добавить договор',
        position: 'top',
        visibilityTime: 3000,
      });
    }
  };

  // Удалить бригаду
  const handleDeleteTeam = async (teamId, teamName) => {
    try {
      // СНАЧАЛА обновляем права с сервера
      const permissions = await refreshPermissions();

      // ПОТОМ проверяем актуальные права
      const canDelete = permissions.includes('mobile-app-can-delete-team:site');

      if (!canDelete) {
        Toast.show({
          type: 'error',
          text1: 'Нет прав',
          text2: 'У вас нет прав для удаления бригады',
          position: 'top',
          visibilityTime: 3000,
        });
        return;
      }

      // Если права есть - показываем подтверждение
      Alert.alert(
        'Удалить бригаду?',
        `Вы уверены, что хотите удалить бригаду "${teamName}"?`,
        [
          { text: 'Отмена', style: 'cancel' },
          {
            text: 'Удалить',
            style: 'destructive',
            onPress: async () => {
              try {
                await timesheetAPI.removeTeam(teamId);
                Toast.show({
                  type: 'success',
                  text1: 'Успешно',
                  text2: `Бригада "${teamName}" удалена`,
                  position: 'top',
                  visibilityTime: 2000,
                });
                setTimeout(() => loadDays(minIndex, maxIndex, true), 300);
              } catch (error) {
                Toast.show({
                  type: 'error',
                  text1: 'Ошибка',
                  text2: 'Не удалось удалить бригаду',
                  position: 'top',
                  visibilityTime: 3000,
                });
              }
            },
          },
        ]
      );
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Ошибка',
        text2: 'Не удалось проверить права',
        position: 'top',
        visibilityTime: 3000,
      });
    }
  };

  // Удалить договор
  const handleDeleteContract = async (contractId, contractName) => {
    try {
      // СНАЧАЛА обновляем права с сервера
      const permissions = await refreshPermissions();

      // ПОТОМ проверяем актуальные права
      const canDelete = permissions.includes('mobile-app-can-delete-contract:site');

      if (!canDelete) {
        Toast.show({
          type: 'error',
          text1: 'Нет прав',
          text2: 'У вас нет прав для удаления договора',
          position: 'top',
          visibilityTime: 3000,
        });
        return;
      }

      // Если права есть - показываем подтверждение
      Alert.alert(
        'Удалить договор?',
        `Вы уверены, что хотите удалить договор "${contractName}"?`,
        [
          { text: 'Отмена', style: 'cancel' },
          {
            text: 'Удалить',
            style: 'destructive',
            onPress: async () => {
              try {
                await timesheetAPI.removeContract(contractId);
                Toast.show({
                  type: 'success',
                  text1: 'Успешно',
                  text2: 'Договор удален',
                  position: 'top',
                  visibilityTime: 2000,
                });
                setTimeout(() => loadDays(minIndex, maxIndex, true), 300);
              } catch (error) {
                Toast.show({
                  type: 'error',
                  text1: 'Ошибка',
                  text2: 'Не удалось удалить договор',
                  position: 'top',
                  visibilityTime: 3000,
                });
              }
            },
          },
        ]
      );
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Ошибка',
        text2: 'Не удалось проверить права',
        position: 'top',
        visibilityTime: 3000,
      });
    }
  };

  // Добавить комментарий
  const handleAddComment = async (timesheetContractId) => {
    if (!commentText.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Ошибка',
        text2: 'Введите текст комментария',
        position: 'top',
        visibilityTime: 2000,
      });
      return;
    }

    try {
      // СНАЧАЛА обновляем права с сервера
      const permissions = await refreshPermissions();

      // ПОТОМ проверяем актуальные права
      const canCreate = permissions.includes('mobile-app-can-create-comment:site');

      if (!canCreate) {
        Toast.show({
          type: 'error',
          text1: 'Нет прав',
          text2: 'У вас нет прав для добавления комментария',
          position: 'top',
          visibilityTime: 3000,
        });
        return;
      }

      // Если права есть - добавляем комментарий
      await timesheetAPI.addComment(timesheetContractId, commentText.trim());
      setCommentText('');
      Toast.show({
        type: 'success',
        text1: 'Успешно',
        text2: 'Комментарий добавлен',
        position: 'top',
        visibilityTime: 2000,
      });
      setTimeout(() => loadDays(minIndex, maxIndex, true), 500);
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Ошибка',
        text2: error.message || 'Не удалось добавить комментарий',
        position: 'top',
        visibilityTime: 3000,
      });
    }
  };

  // Удалить комментарий
  const handleDeleteComment = async (commentId) => {
    try {
      // СНАЧАЛА обновляем права с сервера
      const permissions = await refreshPermissions();

      // ПОТОМ проверяем актуальные права
      const canDelete = permissions.includes('mobile-app-can-delete-comment:site');

      if (!canDelete) {
        Toast.show({
          type: 'error',
          text1: 'Нет прав',
          text2: 'У вас нет прав для удаления комментария',
          position: 'top',
          visibilityTime: 3000,
        });
        return;
      }

      // Если права есть - показываем подтверждение
      Alert.alert(
        'Удалить комментарий?',
        `Вы уверены, что хотите удалить комментарий?`,
        [
          { text: 'Отмена', style: 'cancel' },
          {
            text: 'Удалить',
            style: 'destructive',
            onPress: async () => {
              try {
                await timesheetAPI.removeComment(commentId);
                Toast.show({
                  type: 'success',
                  text1: 'Успешно',
                  text2: 'Комментарий удален',
                  position: 'top',
                  visibilityTime: 2000,
                });
                setTimeout(() => loadDays(minIndex, maxIndex, true), 300);
              } catch (error) {
                Toast.show({
                  type: 'error',
                  text1: 'Ошибка',
                  text2: 'Не удалось удалить комментарий',
                  position: 'top',
                  visibilityTime: 3000,
                });
              }
            },
          },
        ]
      );
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Ошибка',
        text2: 'Не удалось проверить права',
        position: 'top',
        visibilityTime: 3000,
      });
    }
  };

  // Обработчик выхода
  const handleLogout = () => {
    setLogoutModalVisible(true);
  };

  const confirmLogout = async () => {
    setLogoutModalVisible(false);
    try {
      await timesheetAPI.logout();
      onLogout();
    } catch (error) {
      // Даже если запрос logout не прошел, выходим
      onLogout();
    }
  };

  // Обработчик календаря
  const handleCalendarPress = () => {
    setCalendarModalVisible(true);
  };

  const handleDateSelect = async (date) => {
    setCalendarModalVisible(false);

    // Вычисляем разницу в днях между выбранной датой и сегодня
    const selectedDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    selectedDate.setHours(0, 0, 0, 0);

    const diffTime = selectedDate - today;
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    // Находим индекс в массиве days
    const targetIndex = days.findIndex(day => day.index === diffDays);

    if (targetIndex !== -1) {
      // День уже загружен, просто прокручиваем к нему
      if (flatListRef.current) {
        flatListRef.current.scrollToIndex({
          index: targetIndex,
          animated: true,
        });
        setCurrentIndex(targetIndex);
      }
    } else {
      // День не загружен - просто прокручиваем к ближайшему краю
      // (все дни уже загружены в диапазоне ±30)
      Toast.show({
        type: 'info',
        text1: 'Информация',
        text2: 'Выбранная дата за пределами доступного диапазона',
        position: 'top',
        visibilityTime: 2000,
      });
    }
  };

  const renderDay = ({ item }) => {
    // Извлекаем год из humanDate (например "4 ноября 2025")
    const dateMatch = item.humanDate?.match(/(\d{4})/);
    const year = dateMatch ? dateMatch[1] : '';

    // Извлекаем день и месяц
    const dateWithoutYear = item.humanDate?.replace(/\s*\d{4}\s*г?\.?/, '').trim() || item.humanDate;

    return (
      <View style={styles.dayContainer}>
        <View style={[styles.card, item.isToday && styles.cardToday]}>
          {/* Заголовок */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.dateText}>{dateWithoutYear}</Text>
              <Text style={styles.weekDay}>{item.weekDay}</Text>
            </View>
            <View style={styles.headerRight}>
              <Text style={styles.yearText}>{year} г</Text>
              <View style={styles.spacer} />
              {item.isToday && <Text style={styles.todayLabel}>Сегодня</Text>}
            </View>
          </View>

        {/* Контент */}
        <ScrollView style={styles.content}>
          {item.teams && item.teams.length > 0 ? (
            item.teams.map((team) => (
              <TouchableOpacity
                key={team.id}
                style={styles.team}
                activeOpacity={0.8}
                onLongPress={() => handleDeleteTeam(team.id, team.master?.full_name || 'Без имени')}
              >
                <View style={styles.teamHeader}>
                  <Text style={styles.masterName}>
                    {team.master?.full_name || 'Без имени'}
                  </Text>
                  <Can permission="mobile-app-can-create-contract:site">
                    <TouchableOpacity
                      style={styles.addButtonCompact}
                      onPress={() => openAddContractModal(team.id)}
                    >
                      <Text style={styles.addButtonCompactText}>+</Text>
                    </TouchableOpacity>
                  </Can>
                </View>

                {team.contracts && team.contracts.length > 0 ? (
                  team.contracts.map((contract) => (
                    <View key={contract.timesheet_contract_id} style={styles.contractWrapper}>
                      <TouchableOpacity
                        style={styles.contract}
                        activeOpacity={0.8}
                        onPress={() =>
                          setExpandedContract(
                            expandedContract === contract.timesheet_contract_id
                              ? null
                              : contract.timesheet_contract_id
                          )
                        }
                        onLongPress={() =>
                          handleDeleteContract(
                            contract.timesheet_contract_id,
                            `${contract.object_number} - ${contract.title}`
                          )
                        }
                      >
                        <Text style={styles.contractTitle}>
                          {contract.object_number} - {contract.title}
                        </Text>
                        {contract.chat && contract.chat.length > 0 && (
                          <Text style={styles.commentsCount}>
                            Комментариев: {contract.chat.length}
                          </Text>
                        )}
                      </TouchableOpacity>

                      {/* Чат */}
                      {expandedContract === contract.timesheet_contract_id && (
                        <View style={styles.chatContainer}>
                          {contract.chat && contract.chat.length > 0 ? (
                            contract.chat.map((comment) => (
                              <TouchableOpacity
                                key={comment.id}
                                style={[
                                  styles.chatMessage,
                                  comment.self && styles.chatMessageSelf,
                                ]}
                                onLongPress={() => handleDeleteComment(comment.id)}
                              >
                                <Text style={styles.chatAuthor}>
                                  {comment.from?.full_name || 'Неизвестно'}
                                </Text>
                                <Text style={styles.chatText}>{comment.message}</Text>
                                <Text style={styles.chatDate}>{comment.created_at}</Text>
                              </TouchableOpacity>
                            ))
                          ) : (
                            <Text style={styles.emptyText}>Нет комментариев</Text>
                          )}

                          {/* Поле ввода */}
                          <Can permission="mobile-app-can-create-comment:site">
                            <View style={styles.chatInput}>
                              <TextInput
                                style={styles.chatTextInput}
                                placeholder="Ваш комментарий..."
                                value={commentText}
                                onChangeText={setCommentText}
                                multiline
                              />
                              <TouchableOpacity
                                style={styles.chatSendButton}
                                onPress={() => handleAddComment(contract.timesheet_contract_id)}
                              >
                                <Text style={styles.chatSendButtonText}>Отправить</Text>
                              </TouchableOpacity>
                            </View>
                          </Can>
                        </View>
                      )}
                    </View>
                  ))
                ) : (
                  <Text style={styles.emptyText}>Нет договоров</Text>
                )}
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Нет бригад</Text>
            </View>
          )}
        </ScrollView>

        {/* Кнопка добавления бригады */}
        <Can permission="mobile-app-can-create-team:site">
          <TouchableOpacity
            style={styles.addTeamButton}
            onPress={() => openAddTeamModal(item)}
          >
            <Text style={styles.addTeamButtonText}>+ Добавить бригаду</Text>
          </TouchableOpacity>
        </Can>
      </View>
    </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#9588a5" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>

      {/* Модальное окно календаря */}
      <Modal
        visible={calendarModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setCalendarModalVisible(false)}
        statusBarTranslucent={true}
      >
        <StatusBar backgroundColor="rgba(0,0,0,0.5)" />
        <View style={styles.modalOverlay}>
          <View style={styles.modalBlurLayer} />
          <View style={styles.calendarModalContent}>
            <Text style={styles.modalTitle}>Выберите дату</Text>
            <CalendarPicker
              onDateChange={handleDateSelect}
              selectedDayColor="#9588a5"
              selectedDayTextColor="#fff"
              todayBackgroundColor="#e2dde7"
              todayTextStyle={{ color: '#867d96' }}
              textStyle={{ color: '#333' }}
              monthTitleStyle={{ color: '#867d96', fontSize: 18, fontWeight: 'bold' }}
              yearTitleStyle={{ color: '#867d96', fontSize: 18, fontWeight: 'bold' }}
              previousTitle="◀"
              nextTitle="▶"
              previousTitleStyle={{ color: '#9588a5', fontSize: 24, fontWeight: 'bold' }}
              nextTitleStyle={{ color: '#9588a5', fontSize: 24, fontWeight: 'bold' }}
              months={['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']}
              weekdays={['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']}
              startFromMonday={true}
              width={SCREEN_WIDTH - 30}
            />
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setCalendarModalVisible(false)}
            >
              <Text style={styles.modalCloseText}>Закрыть</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Модальное окно подтверждения выхода */}
      <Modal
        visible={logoutModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setLogoutModalVisible(false)}
        statusBarTranslucent={true}
      >
        <StatusBar backgroundColor="rgba(0,0,0,0.5)" />
        <View style={styles.modalOverlay}>
          <View style={styles.modalBlurLayer} />
          <View style={styles.logoutModalContent}>
            <Text style={styles.logoutModalTitle}>Выход</Text>
            <Text style={styles.logoutModalText}>Вы уверены, что хотите выйти?</Text>
            <View style={styles.logoutModalButtons}>
              <TouchableOpacity
                style={[styles.logoutModalButton, styles.logoutModalButtonCancel]}
                onPress={() => setLogoutModalVisible(false)}
              >
                <Text style={styles.logoutModalButtonTextCancel}>Отмена</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.logoutModalButton, styles.logoutModalButtonConfirm]}
                onPress={confirmLogout}
              >
                <Text style={styles.logoutModalButtonTextConfirm}>Выйти</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Модальное окно выбора сотрудника */}
      <Modal
        visible={staffModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setStaffModalVisible(false)}
        statusBarTranslucent={true}
      >
        <StatusBar backgroundColor="rgba(0,0,0,0.5)" />
        <View style={styles.modalOverlay}>
          <View style={styles.modalBlurLayer} />
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Выберите сотрудника</Text>
            <ScrollView style={styles.modalList}>
              {staffList.map((staff) => (
                <TouchableOpacity
                  key={staff.id}
                  style={styles.modalItem}
                  onPress={() => handleAddTeam(staff.id, `${staff.sname} ${staff.fname} ${staff.mname}`)}
                >
                  <Text style={styles.modalItemText}>
                    {staff.sname} {staff.fname} {staff.mname}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setStaffModalVisible(false)}
            >
              <Text style={styles.modalCloseText}>Закрыть</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Модальное окно поиска договора */}
      <Modal
        visible={contractModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setContractModalVisible(false)}
        statusBarTranslucent={true}
      >
        <StatusBar backgroundColor="rgba(0,0,0,0.5)" />
        <View style={styles.modalOverlay}>
          <View style={styles.modalBlurLayer} />
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Поиск договора</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Введите номер или название..."
              value={contractSearch}
              onChangeText={searchContracts}
            />
            <ScrollView style={styles.modalList}>
              {contractsList.map((contract) => (
                <TouchableOpacity
                  key={contract.id}
                  style={styles.modalItem}
                  onPress={() => handleAddContract(contract.id)}
                >
                  <Text style={styles.modalItemText}>
                    {contract.object_number} - {contract.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setContractModalVisible(false)}
            >
              <Text style={styles.modalCloseText}>Закрыть</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <FlatList
        ref={flatListRef}
        data={days}
        renderItem={renderDay}
        keyExtractor={(item) => item.index.toString()}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={currentIndex}
        getItemLayout={(data, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        onScrollToIndexFailed={(info) => {
          // Попытка повторной прокрутки
          setTimeout(() => {
            if (flatListRef.current && info.index < days.length) {
              flatListRef.current.scrollToIndex({
                index: info.index,
                animated: false,
              });
            }
          }, 100);
        }}
        onMomentumScrollEnd={(event) => {
          const newIndex = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
          setCurrentIndex(newIndex);

          // Проверяем, не приближаемся ли к краю для подгрузки
          const daysFromEnd = days.length - 1 - newIndex;
          const daysFromStart = newIndex;

          // Если близко к концу - подгружаем вперед
          if (daysFromEnd <= LOAD_MORE_THRESHOLD) {
            loadMoreForward();
          }

          // Если близко к началу - подгружаем назад
          if (daysFromStart <= LOAD_MORE_THRESHOLD) {
            loadMoreBackward();
          }
        }}
      />
      <BottomMenu onLogout={handleLogout} onCalendarPress={handleCalendarPress} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3eff6',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f3eff6',
  },
  dayContainer: {
    width: SCREEN_WIDTH,
    padding: 15,
  },
  card: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardToday: {
    borderWidth: 2,
    borderColor: '#9588a5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: '#e2dde7',
    paddingBottom: 15,
    marginBottom: 15,
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  spacer: {
    flex: 1,
  },
  dateText: {
    fontSize: 22,
    color: '#555',
    fontWeight: 'normal',
  },
  weekDay: {
    fontSize: 22,
    color: '#ccc',
    fontWeight: 'bold',
    marginTop: 2,
  },
  yearText: {
    fontSize: 16,
    color: '#555',
  },
  todayLabel: {
    fontSize: 22,
    color: '#555',
    fontWeight: 'bold',
    marginTop: 2,
  },
  humanDate: {
    fontSize: 16,
    color: '#867d96',
    textAlign: 'center',
    marginTop: 5,
  },
  todayText: {
    fontWeight: 'bold',
    color: '#9588a5',
  },
  content: {
    flex: 1,
  },
  team: {
    backgroundColor: '#f3eff6',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  teamHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  masterName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#555',
    flex: 1,
  },
  addButtonCompact: {
    borderWidth: 2,
    borderColor: '#b5bcc8',
    borderRadius: 8,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  addButtonCompactText: {
    color: '#b5bcc8',
    fontSize: 30,
    fontWeight: '300',
    lineHeight: 32,
    marginTop: -2,
  },
  contract: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
  },
  contractTitle: {
    fontSize: 14,
    color: '#333',
  },
  commentsCount: {
    fontSize: 12,
    color: '#9fa5b2',
    marginTop: 5,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#ccc',
    textAlign: 'center',
  },
  addButton: {
    backgroundColor: '#9588a5',
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  addTeamButton: {
    backgroundColor: '#867d96',
    borderRadius: 10,
    padding: 15,
    marginTop: 10,
    alignItems: 'center',
  },
  addTeamButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 15,
  },
  modalBlurLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    width: SCREEN_WIDTH - 30,
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#9588a5',
    marginBottom: 15,
    textAlign: 'center',
  },
  modalList: {
    maxHeight: 300,
  },
  modalItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e2dde7',
  },
  modalItemText: {
    fontSize: 16,
    color: '#333',
  },
  modalCloseButton: {
    backgroundColor: '#e2dde7',
    borderRadius: 10,
    padding: 12,
    marginTop: 15,
    alignItems: 'center',
  },
  modalCloseText: {
    color: '#867d96',
    fontSize: 16,
    fontWeight: '600',
  },
  searchInput: {
    backgroundColor: '#f3eff6',
    borderRadius: 10,
    padding: 12,
    marginBottom: 15,
    fontSize: 16,
  },
  contractWrapper: {
    marginTop: 8,
  },
  chatContainer: {
    backgroundColor: '#fefefe',
    borderRadius: 8,
    padding: 10,
    marginTop: 5,
  },
  chatMessage: {
    backgroundColor: '#f3eff6',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  chatMessageSelf: {
    backgroundColor: '#e8e0f0',
  },
  chatAuthor: {
    fontSize: 12,
    fontWeight: '600',
    color: '#867d96',
    marginBottom: 4,
  },
  chatText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  chatDate: {
    fontSize: 11,
    color: '#9fa5b2',
  },
  chatInput: {
    flexDirection: 'row',
    marginTop: 10,
    gap: 8,
  },
  chatTextInput: {
    flex: 1,
    backgroundColor: '#f3eff6',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    minHeight: 40,
  },
  chatSendButton: {
    backgroundColor: '#9588a5',
    borderRadius: 8,
    paddingHorizontal: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatSendButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  logoutModalContent: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 25,
    width: SCREEN_WIDTH - 30,
    alignItems: 'center',
  },
  logoutModalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#867d96',
    marginBottom: 15,
  },
  logoutModalText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    marginBottom: 25,
  },
  logoutModalButtons: {
    flexDirection: 'row',
    gap: 15,
    width: '100%',
  },
  logoutModalButton: {
    flex: 1,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  logoutModalButtonCancel: {
    backgroundColor: '#e2dde7',
  },
  logoutModalButtonConfirm: {
    backgroundColor: '#867d96',
  },
  logoutModalButtonTextCancel: {
    color: '#867d96',
    fontSize: 16,
    fontWeight: '600',
  },
  logoutModalButtonTextConfirm: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  calendarModalContent: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    width: SCREEN_WIDTH - 30,
  },
});
