/**
 * Кто прочитал сообщение в группе и чате объекта («Прочитали», галочки).
 *
 * membersRead — докуда дочитал каждый участник (staff_id => id сообщения), membersSince — когда он появился
 * в чате. Вступившему граница прочитанного ставится на последнее сообщение (чтобы история не стала
 * непрочитанной), поэтому читателями сообщения считаются только те, кто был в чате, когда его отправили.
 * Участник без даты вступления (пришло событие о прочтении, а состав ещё не обновился) — был.
 */

const time = (value) => {
  const parsed = value ? new Date(value).getTime() : NaN;
  return Number.isFinite(parsed) ? parsed : null;
};

/** Участники, которые могли прочитать сообщение: были в чате, когда его отправили */
const presentAt = (sentAt, membersSince, staffId) => {
  const since = time(membersSince?.[staffId]);
  const sent = time(sentAt);
  return since === null || sent === null || since < sent;
};

const hasRead = (membersRead, staffId, messageId) => Number(membersRead?.[staffId] ?? 0) >= Number(messageId);

/** Прочитал ли сообщение хоть кто-то из остальных — двойная галочка */
export const isReadByOthers = (message, membersRead, membersSince) => Object.keys(membersRead || {})
  .some((staffId) => hasRead(membersRead, staffId, message.id) && presentAt(message.created_at, membersSince, staffId));

/**
 * Список для «Прочитали»: members — участники из сведений о чате, автор сообщения не входит
 * @returns {{ read: object[], unread: object[] }}
 */
export const readersOf = (message, members, membersRead, membersSince, myStaffId) => {
  const read = [];
  const unread = [];
  (members || []).forEach((member) => {
    const id = Number(member.id);
    if (id === Number(myStaffId) || id === Number(message.from_id)) return;
    if (!presentAt(message.created_at, membersSince, id)) return;
    (hasRead(membersRead, id, message.id) ? read : unread).push(member);
  });
  return { read, unread };
};
