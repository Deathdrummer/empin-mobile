/**
 * Форматирует ФИО в краткий формат: Фамилия И.О.
 * @param {Object} person - Объект с данными о человеке
 * @param {string} person.sname - Фамилия
 * @param {string} person.fname - Имя
 * @param {string} person.mname - Отчество
 * @returns {string} Отформатированное ФИО
 */
export const formatShortName = (person) => {
  if (!person || !person.sname) return 'Без имени';

  const firstNameInitial = person.fname ? person.fname.charAt(0) + '.' : '';
  const middleNameInitial = person.mname ? person.mname.charAt(0) + '.' : '';

  return `${person.sname} ${firstNameInitial}${middleNameInitial}`.trim();
};
