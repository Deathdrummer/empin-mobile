/**
 * Метка повтора для создания на сервере (задание, вставка скопированного). Ответ может не дойти из-за обрыва связи,
 * хотя сервер уже создал запись: то же действие с тем же содержимым уходит с той же меткой, и сервер вернёт уже
 * созданное, а не второе такое же. После успешного ответа метка сбрасывается — следующее такое же действие создаёт
 * новую запись. Изменённое содержимое получает новую метку: иначе сервер вернул бы прежнее, и правка пропала бы молча.
 *
 * @param {() => string} newId
 * @returns {(key: string, send: (uuid: string) => Promise<any>) => Promise<any>}
 */
export const createRepeatKeys = (newId) => {
  const pending = new Map();
  return async (key, send) => {
    if (!pending.has(key)) pending.set(key, newId());
    const result = await send(pending.get(key));
    pending.delete(key);
    return result;
  };
};
