/**
 * Реакции на сообщение — как в карточке задания и на сайте (и как на сервере): у человека их может быть
 * несколько, пара «сотрудник + эмодзи» переключается. Нужна для мгновенного отклика, пока нет ответа сервера.
 */
export const nextReactions = (reactions, userId, emoji, hasReacted) => {
  const list = reactions || [];
  return hasReacted
    ? list.filter((reaction) => !(Number(reaction.user_id) === Number(userId) && reaction.emoji === emoji))
    : [...list, { user_id: userId, emoji }];
};
