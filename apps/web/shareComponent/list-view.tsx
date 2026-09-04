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

function ListItemContent({ item }: { item: ListViewItem }) {
  return <>
    {item.leading && <div className="shared-list-leading">{item.leading}</div>}
    <div className="shared-list-copy">
      <div className="shared-list-title">{item.title}</div>
      {item.description && <div className="shared-list-description">{item.description}</div>}
      {item.meta && <div className="shared-list-meta">{item.meta}</div>}
    </div>
    {item.trailing && <div className="shared-list-trailing">{item.trailing}</div>}
  </>;
}

export function ListView({ items, empty = 'No data yet' }: { items: ListViewItem[]; empty?: React.ReactNode }) {
  if (!items.length) return <div className="shared-list-empty">{empty}</div>;
  return <div className="shared-list-view">
    {items.map((item, index) => item.onClick
      ? <button key={item.id ?? index} type="button" className="shared-list-item is-action" onClick={item.onClick}><ListItemContent item={item} /></button>
      : <div key={item.id ?? index} className="shared-list-item"><ListItemContent item={item} /></div>)}
  </div>;
}
