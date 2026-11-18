import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useThemedStyles } from '../../../theme';
import { ContractCard } from './ContractCard';
import { SwipeBlocker } from '../../../components/SwipeBlocker';
import { shortName } from '../../../utils/tasks';

/**
 * Исполнитель на день и его задания — «карточки объектов для бригад» (инт., блок 7): бригада или сотрудник,
 * под ним объекты. «+ Объект» — новое задание этому исполнителю (право «Создавать задания», не прошедший день).
 */
export const TeamCard = ({ group, canAdd, onAddObject, chat, deletingTask, onOpenTask, onEditTask, onCopyTask, onDeleteTask }) => {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { executor, tasks } = group;
  const isBrigade = executor?.type === 'brigade';
  const name = isBrigade ? executor.name || 'Бригада' : shortName(executor?.name) || 'Сотрудник';

  return (
    <View style={styles.teamWrapper}>
      <View style={styles.teamHeader}>
        <Ionicons name={isBrigade ? 'people' : 'person'} size={18} color={theme.textSecondary} />
        <Text style={styles.masterName} numberOfLines={2}>{name}</Text>
        {canAdd ? (
          <SwipeBlocker>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => onAddObject(executor)}
              activeOpacity={0.7}
              accessibilityLabel={`Добавить объект: ${name}`}
            >
              <Ionicons name="add" size={18} color={theme.accentText} />
              <Text style={styles.addButtonText}>Объект</Text>
            </TouchableOpacity>
          </SwipeBlocker>
        ) : null}
      </View>
      {isBrigade && executor.foreman?.name ? (
        <Text style={styles.foreman}>{`Бригадир: ${shortName(executor.foreman.name)}`}</Text>
      ) : null}

      {tasks.map((task) => (
        <ContractCard
          key={task.id}
          task={task}
          chat={chat}
          deleting={deletingTask === task.id}
          onOpenTask={onOpenTask}
          onEditTask={onEditTask}
          onCopyTask={onCopyTask}
          onDeleteTask={onDeleteTask}
        />
      ))}
    </View>
  );
};

const makeStyles = (theme) => StyleSheet.create({
  teamWrapper: {
    position: 'relative',
    marginBottom: 22,
  },
  teamHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
    paddingTop: 6,
  },
  masterName: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.text,
    flex: 1,
  },
  foreman: {
    fontSize: 13,
    color: theme.textSecondary,
    paddingHorizontal: 30,
    marginTop: 1,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    borderRadius: 16,
    backgroundColor: theme.accentSoft,
    paddingLeft: 8,
    paddingRight: 12,
    paddingVertical: 6,
  },
  addButtonText: {
    color: theme.accentText,
    fontSize: 14,
    fontWeight: '600',
  },
});
