import { useMemo } from 'react';
import { ArrowUpRight, CalendarDays, Droplets } from 'lucide-react';
import SummaryCards from '../components/SummaryCards.jsx';
import ExpensesChart from '../components/ExpensesChart.jsx';
import AssetStatusChart from '../components/AssetStatusChart.jsx';
import RecentActivities from '../components/RecentActivities.jsx';
import AlertsPanel from '../components/AlertsPanel.jsx';
import { monthlyExpenses, recentActivities, summaryCards } from '../data/dashboardData.js';
import useAssets from '../hooks/useAssets.js';
import useInventory from '../hooks/useInventory.js';
import { getInventoryCounts } from '../utils/filterInventory.js';
import useMaintenanceOverview from '../hooks/useMaintenanceOverview.js';
import { buildMaintenanceAlerts } from '../utils/maintenanceDates.js';

function formatToday() {
  return new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
}

export default function DashboardPage() {
  const { assets, state: assetState } = useAssets();
  const { items: inventoryItems, state: inventoryState } = useInventory();
  const inventoryCounts = useMemo(() => getInventoryCounts(inventoryItems), [inventoryItems]);
  const { summary: maintenanceSummary, records: maintenanceRecords, state: maintenanceState } = useMaintenanceOverview();
  const maintenanceAlerts = useMemo(() => buildMaintenanceAlerts(maintenanceRecords), [maintenanceRecords]);
  const liveSummaryCards = useMemo(() => {
    const total = assets.length;
    const active = assets.filter((asset) => asset.status === 'Active').length;
    return summaryCards.map((card) => {
      if (card.source !== 'live') return card;
      const count = card.icon === 'assets' ? total : card.icon === 'active' ? active : card.icon === 'inventory' ? inventoryCounts.total : card.icon === 'stock' ? inventoryCounts.low : maintenanceSummary?.pending ?? 0;
      const sourceState = ['inventory', 'stock'].includes(card.icon) ? inventoryState : card.icon === 'maintenance' ? maintenanceState : assetState;
      return {
        ...card,
        value: sourceState === 'ready' ? count.toLocaleString() : '—',
        detail: sourceState === 'ready' ? 'Saved on this device' : sourceState === 'loading' ? 'Reading local records' : 'Local records unavailable',
        change: sourceState === 'ready' ? (card.icon === 'stock' ? 'Items at reorder threshold' : card.icon === 'maintenance' ? `${maintenanceSummary.overdue} overdue` : 'Verified local count') : sourceState === 'loading' ? 'Checking local data' : 'Desktop service unavailable',
      };
    });
  }, [assets, assetState, inventoryCounts, inventoryState, maintenanceSummary, maintenanceState]);
  const liveAlerts = useMemo(() => [
    ...inventoryItems.filter((item) => item.currentStock <= item.minimumStock).map((item) => ({
      level: 'critical',
      title: `${item.currentStock === 0 ? 'Out of stock' : 'Low stock'}: ${item.name}`,
      detail: `${item.currentStock} ${item.unit} available · minimum ${item.minimumStock}${item.location ? ` · ${item.location}` : ''}`,
      time: 'Inventory attention',
    })),
    ...maintenanceAlerts,
  ], [inventoryItems, maintenanceAlerts]);
  const liveAssetStatuses = useMemo(() => [
    { name: 'Active', value: assets.filter((asset) => asset.status === 'Active').length, color: '#198b78' },
    { name: 'Inactive', value: assets.filter((asset) => asset.status === 'Inactive').length, color: '#82958f' },
    { name: 'Under maintenance', value: assets.filter((asset) => asset.status === 'Under Maintenance').length, color: '#e5a642' },
    { name: 'Decommissioned', value: assets.filter((asset) => asset.status === 'Decommissioned').length, color: '#d9796b' },
  ], [assets]);

  return <div className="dashboard-page">
    <section className="welcome-banner">
      <div className="welcome-copy"><div className="welcome-kicker"><span className="welcome-kicker-dot" /> SCHEME OPERATIONS</div><h2>Good morning, Ravi <span>👋</span></h2><p>Here’s the latest overview of your water supply schemes.</p></div>
      <div className="welcome-meta"><div className="date-chip"><CalendarDays size={15} /><span>{formatToday()}</span></div><div className="demo-chip"><span /> LIVE ASSETS · INVENTORY · MAINTENANCE</div></div>
      <div className="welcome-art" aria-hidden="true"><Droplets size={56} strokeWidth={1.15} /><span className="welcome-art-ring ring-one" /><span className="welcome-art-ring ring-two" /></div>
      <div className="welcome-bottom"><span>KRISHNA WATER BOARD</span><span className="welcome-bottom-divider" /><span>NORTH DISTRICT</span><button type="button" aria-label="Open scheme details"><ArrowUpRight size={15} /></button></div>
    </section>
    <div className="section-title-row"><div><h2>Scheme snapshot</h2><p>Key indicators at a glance</p></div><div className="dashboard-data-key"><span className="live-key"><i /> Live local assets, inventory and maintenance</span><span className="demo-key"><i /> Remaining modules use sample data</span></div></div>
    <SummaryCards cards={liveSummaryCards} />
    <div className="charts-grid"><ExpensesChart data={monthlyExpenses} /><AssetStatusChart data={liveAssetStatuses} state={assetState} /></div>
    <div className="details-grid"><RecentActivities activities={recentActivities} /><AlertsPanel alerts={liveAlerts} /></div>
    <footer className="dashboard-footer"><span>SmartWater Operations</span><span>Asset, inventory and maintenance indicators use local records. Remaining modules show illustrative sample data.</span></footer>
  </div>;
}
