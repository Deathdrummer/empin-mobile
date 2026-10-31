/**
 * Кто прочитал сообщение в группе и чате объекта («Прочитали», галочки).
 *
 * membersRead — докуда дочитал каждый участник (staff_id => id сообщения), membersJoined — граница прочитанного
 * при вступлении. Вступившему она ставится на последнее сообщение (чтобы история не стала непрочитанной), поэтому
 * сообщение прочитали только те, для кого оно новее этой границы. null или нет данных (старый сервер, событие
 * о прочтении пришло раньше состава) — участник в чате с самого начала.
 */

const presentFor = (messageId, membersJoined, staffId) => {
  const joined = membersJoined?.[staffId];
  return joined === null || joined === undefined || Number(messageId) > Number(joined);
};

const hasRead = (membersRead, staffId, messageId) => Number(membersRead?.[staffId] ?? 0) >= Number(messageId);

/** Прочитал ли сообщение хоть кто-то из остальных — двойная галочка */
export const isReadByOthers = (message, membersRead, membersJoined) => Object.keys(membersRead || {})
  .some((staffId) => hasRead(membersRead, staffId, message.id) && presentFor(message.id, membersJoined, staffId));

/**
 * Список для «Прочитали»: members — участники из сведений о чате, автор сообщения не входит
 * @returns {{ read: object[], unread: object[] }}
 */
export const readersOf = (message, members, membersRead, membersJoined, myStaffId) => {
  const read = [];
  const unread = [];
  (members || []).forEach((member) => {
    const id = Number(member.id);
    if (id === Number(myStaffId) || id === Number(message.from_id)) return;
    if (!presentFor(message.id, membersJoined, id)) return;
    (hasRead(membersRead, id, message.id) ? read : unread).push(member);
  });
  return { read, unread };
};
