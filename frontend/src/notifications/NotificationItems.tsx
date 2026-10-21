import { translateUi, formatDisplay, useLanguage, dateFormatter } from '../i18n';
import { Link } from 'react-router-dom';
import { useNotifications, type Notification } from './useNotifications';

export const severities = { INFO: 'معلومة', WARNING: 'تنبيه', URGENT: 'عاجل' };
const date = dateFormatter({ dateStyle: 'short', timeStyle: 'short', timeZone: 'Africa/Cairo' });
export function NotificationItems({ items, close }: { items: Notification[]; close?: () => void }) {
  useLanguage();
  const { markRead } = useNotifications();
  if (!items.length) return <p className="state">{translateUi("لا توجد إشعارات")}</p>;
  return <ul className="notification-items">{formatDisplay(items.map(item => <li key={item.id} className={item.readAt ? '' : 'notification-unread'}>
    <Link to={item.target} onClick={() => { close?.(); if (!item.readAt) void markRead(item.id); }}>
      <span className={`badge notification-${item.severity.toLowerCase()}`}>{formatDisplay(severities[item.severity])}</span>
      <strong>{formatDisplay(item.title)}</strong><span>{formatDisplay(item.body)}</span>
      <time dateTime={item.createdAt}>{formatDisplay(date.format(new Date(item.createdAt)))}{' '}{translateUi("· القاهرة")}</time>
    </Link>
    {formatDisplay(!item.readAt && <button className="quiet" onClick={() => void markRead(item.id)}>{translateUi("تحديد كمقروء")}</button>)}
  </li>))}</ul>;
}
