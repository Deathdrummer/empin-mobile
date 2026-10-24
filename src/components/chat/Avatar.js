import React, { useEffect, useState } from 'react';
import { Image, View, Text, StyleSheet } from 'react-native';
import { avatarColor } from '../../theme';
import { initials } from '../../utils/chatFormat';
import { resolveMediaUri } from '../../utils/mediaUri';

/**
 * Аватар сотрудника: фото, если оно есть (person.avatar), иначе инициалы на постоянном для него цвете.
 * Фото не загрузилось — остаются инициалы.
 */
export const Avatar = ({ person, id, size = 48 }) => {
  const uri = resolveMediaUri(person?.avatar);
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [uri]);

  const shape = { width: size, height: size, borderRadius: size / 2 };

  return (
    <View style={[styles.avatar, shape, { backgroundColor: avatarColor(id ?? person?.id) }]}>
      <Text style={[styles.text, { fontSize: Math.round(size * 0.36) }]}>{initials(person)}</Text>
      {uri && !failed ? (
        <Image source={{ uri }} style={[StyleSheet.absoluteFill, shape]} onError={() => setFailed(true)} />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  text: {
    color: '#FFFFFF',
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
