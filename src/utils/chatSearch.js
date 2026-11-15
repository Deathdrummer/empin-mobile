/**
 * Поиск внутри чата листается страницами, как в Telegram: сервер отдаёт свежие совпадения, следующая
 * страница — старше самого старого из показанных (before_id). Первая страница несёт общее число совпадений.
 * Старый сервер страниц не знает (нет has_more и total) — тогда показывается то, что он прислал.
 */

/** Первая страница: совпадения, есть ли продолжение, сколько всего (null — сервер не сообщил) */
export const firstSearchPage = (data) => ({
  results: data?.messages || [],
  hasMore: Boolean(data?.has_more),
  total: Number.isInteger(data?.total) ? data.total : null,
});

/**
 * Следующая страница к уже показанным: без повторов. Если страница не принесла ничего нового,
 * дальше не просим — иначе прокрутка к концу запрашивала бы одно и то же без конца.
 */
export const appendSearchPage = (results, data) => {
  const seen = new Set(results.map((hit) => hit.message_id));
  const fresh = (data?.messages || []).filter((hit) => !seen.has(hit.message_id));
  return {
    results: fresh.length ? [...results, ...fresh] : results,
    hasMore: Boolean(data?.has_more) && fresh.length > 0,
  };
};

/** before_id следующей страницы — самое старое из показанных совпадений; null — показывать нечего */
export const searchCursor = (results) => {
  const ids = results.map((hit) => Number(hit.message_id)).filter((id) => Number.isInteger(id) && id > 0);
  return ids.length ? Math.min(...ids) : null;
};
