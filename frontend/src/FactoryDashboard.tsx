import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Factory, MapPin, RefreshCw, Search, ListTree, Wrench } from 'lucide-react';
import { useQuery } from './localizedQuery';
import { api } from './api';
import { can, useAuth } from './access';
import { translateUi as t, formatDisplay as f, searchable, useLanguage, dateFormatter } from './i18n';
import type { Machine } from './catalog';
import { type Order } from './OrdersPage';
import { Busy, Denied, IconButton, QueryError } from './ui';
import { FileButton } from './Files';
import { MachineChatButton, useChatUnread } from './MachineChat';
import { ResourceVisual } from './CatalogMedia';

type Overview = { metrics: Record<string, number>; states: { status: string; count: number }[] };
const states: Record<string, string> = { DRAFT: 'مسودة', OPEN: 'مفتوح', IN_PROGRESS: 'قيد التجميع', AWAITING_TESTING: 'بانتظار تجربة التشغيل', TESTING: 'قيد تجربة التشغيل', REWORK: 'معالجة بعد التجربة', COMPLETED: 'مكتمل', CANCELLED: 'ملغي' };
const metrics = [
  ['machines', 'ماكينات نشطة'], ['orders', 'إجمالي الطلبات'], ['active', 'طلبات قيد التنفيذ'], ['completed', 'طلبات مكتملة'],
  ['delivered', 'تم التسليم'], ['late', 'تسليمات متأخرة'], ['missing', 'قطع ناقصة للطلبات الجارية'], ['defects', 'عيوب مفتوحة'],
  ['available', 'قطع متاحة بالمخزن'], ['quarantined', 'قطع تحت الفحص'], ['running', 'جلسات عمل جارية'], ['unassigned', 'مهام بدون عامل'],
];
export function FactoryDashboardPage() {
  useLanguage();
  const { user } = useAuth();
  const seeMachines = can(user, 'machines.view'), seeOrders = can(user, 'orders.view') || can(user, 'orders.view-assigned'), seeStats = can(user, 'reports.view');
  const machines = useQuery({ queryKey: ['/machines'], queryFn: () => api<Machine[]>('/machines'), enabled: seeMachines, refetchInterval: 15000 });
  const orders = useQuery({ queryKey: ['/manufacturing-orders'], queryFn: () => api<Order[]>('/manufacturing-orders'), enabled: seeMachines && seeOrders, refetchInterval: 15000 });
  const stats = useQuery({ queryKey: ['factory-dashboard'], queryFn: () => api<Overview>('/factory-dashboard'), enabled: seeStats, refetchInterval: 15000 });
  const unread = useChatUnread(seeMachines);
  const [search, setSearch] = useState(''), [status, setStatus] = useState('all');
  if (!seeMachines && !seeStats) return <Denied />;
  const byMachine = new Map<string, Order[]>();
  for (const order of orders.data ?? []) { const group = byMachine.get(order.machineId) ?? []; group.push(order); byMachine.set(order.machineId, group); }
  for (const group of byMachine.values()) group.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
  const latest = (machine: Machine) => { const group = byMachine.get(machine.id) ?? []; return group.find(o => !['CANCELLED', 'COMPLETED'].includes(o.status)) ?? group.find(o => o.status !== 'CANCELLED'); };
  const visible = (machines.data ?? []).filter(m => searchable(`${m.name} ${m.serialNumber} ${m.modelName} ${m.location}`).toLowerCase().includes(search.trim().toLowerCase()) &&
    (status === 'all' || (status === 'archived' ? !m.active : status === 'none' ? !latest(m) : latest(m)?.status === status)));
  const counts = new Map((unread.data ?? []).map(v => [v.machineId, v.count]));
  const refresh = () => Promise.all([...(seeMachines ? [machines.refetch(), unread.refetch()] : []), ...(seeOrders && seeMachines ? [orders.refetch()] : []), ...(seeStats ? [stats.refetch()] : [])]);
  const pending = machines.isFetching || orders.isFetching || stats.isFetching;
  const values = stats.data?.metrics;
  return <div className="factory-dashboard">
    <div className="page-heading"><div><div className="eyebrow">{t('نظرة على المصنع')}</div><h1>{t('لوحة إدارة المصنع')}</h1><p className="muted">{t('إحصائيات العمل وتصميمات الماكينات ومحادثات الفريق في مكان واحد.')}</p></div>
      <IconButton label={t('تحديث لوحة المصنع')} disabled={pending} onClick={() => void refresh()}><RefreshCw size={18} className={pending ? 'spin' : ''} /></IconButton></div>
    <p className="muted">{t('تحديث تلقائي كل 15 ثانية · الإحصائيات تشمل كل الفترات.')}</p>
    {seeStats && (stats.isPending ? <Busy /> : stats.error ? <QueryError error={stats.error} retry={() => void stats.refetch()} /> : values && <>
      <dl className="factory-metrics">{metrics.map(([key, label]) => <div key={key} className={['late', 'missing', 'defects'].includes(key) && values[key] > 0 ? 'metric-alert' : ''}><dt>{t(label)}</dt><dd>{f(values[key])}</dd></div>)}</dl>
      <div className="factory-overview"><section><h2>{t('توزيع حالات الطلبات')}</h2>{stats.data?.states.length ? stats.data.states.map(s => <div className="factory-state" key={s.status}><span>{t(states[s.status] ?? s.status)}</span><progress aria-label={t(states[s.status] ?? s.status)} max={Math.max(1, values.orders)} value={s.count} /><b>{f(s.count)}</b></div>) : <p className="muted">{t('لا توجد طلبات تصنيع بعد.')}</p>}</section>
        <section><h2>{t('تجميع الطلبات الجارية')}</h2><strong className="factory-percent">{f(values.required ? Math.round(values.installed / values.required * 100) : 0)}%</strong><progress aria-label={t('تجميع الطلبات الجارية')} max={Math.max(1, values.required)} value={values.installed} /><p className="muted">{t('{{v0}} من {{v1}} قطعة مركبة', { v0: values.installed, v1: values.required })}</p>{can(user, 'reports.view') && <Link className="inline-link" to="/reports">{t('متابعة المصنع والتقارير')}</Link>}</section></div>
    </>)}
    {seeMachines && <><div className="page-heading"><div><h2>{t('الماكينات')} <span className="count">{f(visible.length)}</span></h2><p className="muted">{t('محادثة وتصميم مستقل لكل ماكينة. تقدم التجميع يخص أحدث طلب جارٍ أو آخر طلب مكتمل.')}</p></div><Link className="inline-link" to="/machines">{t('إدارة الماكينات')}</Link></div>
      <div className="toolbar"><label className="search"><Search size={18} /><input aria-label={t('بحث الماكينات')} placeholder={t('بحث بالاسم أو الكود')} value={search} onChange={e => setSearch(e.target.value)} /></label><select aria-label={t('تصفية الماكينات')} value={status} onChange={e => setStatus(e.target.value)}><option value="all">{t('كل الماكينات')}</option>{seeOrders && <><option value="none">{t('بدون طلب')}</option>{Object.entries(states).filter(([v]) => v !== 'CANCELLED').map(([v, n]) => <option key={v} value={v}>{t(n)}</option>)}</>}<option value="archived">{t('مؤرشفة')}</option></select></div>
      {machines.isPending ? <Busy /> : machines.error ? <QueryError error={machines.error} retry={() => void machines.refetch()} /> : <>
        {seeOrders && orders.error && <QueryError error={orders.error} retry={() => void orders.refetch()} />}
        {unread.error && <QueryError error={unread.error} retry={() => void unread.refetch()} />}
        {!can(user, 'orders.view') && <p className="notice">{t('تظهر الطلبات حسب صلاحيات حسابك.')}</p>}
        <div className="factory-machine-grid">{visible.map(machine => {
          const order = latest(machine), released = order && !['DRAFT', 'CANCELLED'].includes(order.status);
          const percent = released && order.requiredCount ? Math.min(100, Math.round(order.installedCount / order.requiredCount * 100)) : 0;
          return <article className="factory-machine" key={machine.id}>
            <div className="factory-machine-top"><Factory size={24} /><span className={`badge ${machine.active ? 'active' : 'inactive'}`}>{t(machine.active ? 'نشط' : 'مؤرشف')}</span></div>
            <ResourceVisual kind="MACHINE" id={machine.id} name={machine.name} />
            <span className="record-code" dir="ltr">{machine.serialNumber}</span><h3>{f(machine.name)}</h3><p className="muted">{f(machine.modelName)}</p><p className="factory-location"><MapPin size={15} />{f(machine.location || 'لم يُحدد الموقع')}</p>
            {seeOrders && (orders.isPending ? <Busy /> : orders.error ? <p className="muted">{t('تعذر تحميل تقدم الطلبات.')}</p> : <div className="factory-machine-order">{order ? <><Link className="inline-link" to={`/orders/${order.id}`}>{f(order.title)}</Link><span className="badge draft">{t(order.deliveredAt ? 'تم التسليم' : states[order.status])}</span><progress aria-label={t('اكتمال تجميع {{v0}}', { v0: machine.serialNumber })} value={percent} max={100} /><span>{t('اكتمال التجميع')}: {f(percent)}%</span><small>{t('التسليم:')} {dateFormatter({ dateStyle: 'short', timeZone: 'Africa/Cairo' }).format(new Date(order.deliveryAt))}</small>{!order.deliveredAt && released && new Date(order.deliveryAt).getTime() < Date.now() && <small className="field-error">{t('متأخر عن موعد التسليم')}</small>}</> : <p className="muted">{t('بدون طلب')}</p>}</div>)}
            <div className="factory-machine-actions"><MachineChatButton id={machine.id} name={machine.name} unread={counts.get(machine.id)} /><FileButton kind="MACHINE" id={machine.id} name={machine.name} /></div>
            <div className="factory-machine-links">{can(user, 'catalog.view') && can(user, 'boms.view') && <Link className="inline-link" to={`/boms?machine=${machine.id}`}><ListTree size={16} />{t('قطع الماكينة')}</Link>}{can(user, 'tasks.view') && can(user, 'orders.view') && <Link className="inline-link" to={`/machines/${machine.id}/assembly`}><Wrench size={16} />{t('التركيب وسجل الفك')}</Link>}</div>
          </article>;
        })}</div>{!visible.length && <p className="state">{t('لا توجد نتائج')}</p>}
      </>}
    </>}
  </div>;
}
