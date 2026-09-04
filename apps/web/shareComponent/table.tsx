'use client';

import * as React from 'react';

export type TableColumn<T> = {
  key: string;
  label: string;
  render?: (row: T, index: number) => React.ReactNode;
  className?: string;
};

export function Table<T>({
  rows,
  columns,
  getRowKey,
  empty = 'No data yet',
}: {
  rows: T[];
  columns: TableColumn<T>[];
  getRowKey?: (row: T, index: number) => React.Key;
  empty?: React.ReactNode;
}) {
  return (
    <div className="shared-table-wrap">
      <table className="shared-table">
        <thead>
          <tr>
            {columns.map(column => (
              <th key={column.key} className={column.className} scope="col">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="shared-table-empty">
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr key={getRowKey?.(row, index) ?? index}>
                {columns.map(column => (
                  <td key={column.key} className={column.className}>
                    {column.render ? column.render(row, index) : String((row as Record<string, unknown>)[column.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
