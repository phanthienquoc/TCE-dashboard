'use client';

import * as React from 'react';

export type ListViewItem = {
  id?: React.Key;
  title: React.ReactNode;
  description?: React.ReactNode;
  meta?: React.ReactNode;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  onClick?: () => void;
};

export function ListView({
  items,
  empty = 'No data yet',
}: {
  items: ListViewItem[];
  empty?: React.ReactNode;
}) {
  if (!items.length) {
    return <div className="shared-list-empty">{empty}</div>;
  }

  return (
    <div className="shared-list-view">
      {items.map((item, index) => {
        const Tag = item.onClick ? 'button' : 'div';
        return (
          <Tag
            key={item.id ?? index}
            type={item.onClick ? 'button' : undefined}
            className={`shared-list-item${item.onClick ? ' is-action' : ''}`}
            onClick={item.onClick}
          >
            {item.leading && <div className="shared-list-leading">{item.leading}</div>}
            <div className="shared-list-copy">
              <div className="shared-list-title">{item.title}</div>
              {item.description && <div className="shared-list-description">{item.description}</div>}
              {item.meta && <div className="shared-list-meta">{item.meta}</div>}
            </div>
            {item.trailing && <div className="shared-list-trailing">{item.trailing}</div>}
          </Tag>
        );
      })}
    </div>
  );
}
