import React from 'react';
import { usePermissions } from '../hooks/usePermissions';

/**
 * Компонент для условного рендеринга на основе прав
 * Аналог Blade директивы @can
 *
 * @example
 * <Can permission="contract-col-date_report_from:site">
 *   <Text>Виден только при наличии права</Text>
 * </Can>
 *
 * @example
 * <Can any={["permission1:site", "permission2:site"]}>
 *   <Text>Виден при наличии хотя бы одного права</Text>
 * </Can>
 *
 * @example
 * <Can all={["permission1:site", "permission2:site"]}>
 *   <Text>Виден только при наличии всех прав</Text>
 * </Can>
 */
export const Can = ({ permission, any, all, children, fallback = null }) => {
  const { can, canAny, canAll, loading } = usePermissions();

  // Во время загрузки прав ничего не показываем (или можно показать fallback)
  if (loading) {
    return fallback;
  }

  // Проверка одного права
  if (permission && !can(permission)) {
    return fallback;
  }

  // Проверка хотя бы одного из прав
  if (any && !canAny(any)) {
    return fallback;
  }

  // Проверка всех прав
  if (all && !canAll(all)) {
    return fallback;
  }

  return children;
};
