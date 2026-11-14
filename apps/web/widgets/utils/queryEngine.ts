import { useMemo } from 'react';
import { QueryConfig } from '../../types';
import { useDataStore } from '../../store/useDataStore';

export const executeQuery = (
  rawRecords: Record<string, any>[] | undefined,
  queryConfig?: QueryConfig | null
): Record<string, any>[] | null => {
  if (!queryConfig?.definition?.tableId) {
    return null;
  }

  if (!rawRecords) return [];

  const { select, limit, orderBy, orderDir } = queryConfig.definition;
  let data = [...rawRecords];

  if (orderBy) {
    data.sort((a, b) => {
      const valA = a[orderBy];
      const valB = b[orderBy];
      if (valA === valB) return 0;
      if (valA === undefined || valA === null) return 1;
      if (valB === undefined || valB === null) return -1;
      if (valA < valB) return orderDir === 'desc' ? 1 : -1;
      return orderDir === 'desc' ? -1 : 1;
    });
  }

  if (select && Array.isArray(select) && select.length > 0) {
    const selectedSet = new Set(select);
    data = data.map((row) => {
      const projected: Record<string, any> = {};
      if (row.id !== undefined) {
        projected.id = row.id;
      }
      for (const key of selectedSet) {
        if (key in row) {
          projected[key] = row[key];
        }
      }
      return projected;
    });
  }

  if (limit && limit > 0) {
    data = data.slice(0, limit);
  }

  return data;
};

export const useWidgetQuery = (queryConfig?: QueryConfig | null) => {
  const tableId = queryConfig?.definition?.tableId;
  const rawRecords = useDataStore((s) =>
    tableId ? s.records[tableId] : undefined
  );

  return useMemo(
    () => executeQuery(rawRecords, queryConfig),
    [rawRecords, queryConfig]
  );
};
