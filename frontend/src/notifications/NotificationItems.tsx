import { Link } from 'react-router-dom';
import { useNotifications, type Notification } from './useNotifications';

export const severities = { INFO: 'معلومة', WARNING: 'تنبيه', URGENT: 'عاجل' };
const date = new Intl.DateTimeFormat('ar-EG', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Africa/Cairo' });
export function NotificationItems({ items, close }: { items: Notification[]; close?: () => void }) {
  const { markRead } = useNotifications();
  if (!items.length) return <p className="state">لا توجد إشعارات</p>;
  return <ul className="notification-items">{items.map(item => <li key={item.id} className={item.readAt ? '' : 'notification-unread'}>
    <Link to={item.target} onClick={() => { close?.(); if (!item.readAt) void markRead(item.id); }}>
      <span className={`badge notification-${item.severity.toLowerCase()}`}>{severities[item.severity]}</span>
      <strong>{item.title}</strong><span>{item.body}</span>
      <time dateTime={item.createdAt}>{date.format(new Date(item.createdAt))} · القاهرة</time>
    </Link>
    {!item.readAt && <button className="quiet" onClick={() => void markRead(item.id)}>تحديد كمقروء</button>}
  </li>)}</ul>;
}
