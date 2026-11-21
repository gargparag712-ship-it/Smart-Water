import { Droplets, LifeBuoy } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { primaryNavigation, secondaryNavigation } from '../data/navigation.js';
import ConnectionStatus from './ConnectionStatus.jsx';
import useInventory from '../hooks/useInventory.js';
import { getInventoryCounts } from '../utils/filterInventory.js';
import useMaintenanceOverview from '../hooks/useMaintenanceOverview.js';

function NavigationGroup({ items, lowStockCount, maintenanceCount }) {
  return (
    <nav className="side-nav" aria-label="Main navigation">
      {items.map(({ label, path, icon: Icon }) => (
        <NavLink key={path} end={path === '/'} to={path} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
          <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
          <span>{label}</span>
          {label === 'Inventory' && <span className="nav-count" aria-label={`${lowStockCount} low stock items`}>{lowStockCount}</span>}
          {label === 'Maintenance' && <span className="nav-count" aria-label={`${maintenanceCount} maintenance items needing attention`}>{maintenanceCount}</span>}
        </NavLink>
      ))}
    </nav>
  );
}

export default function Sidebar() {
  const { items, state } = useInventory();
  const { summary, state: maintenanceState } = useMaintenanceOverview();
  const lowStockCount = state === 'ready' ? getInventoryCounts(items).low : '—';
  const maintenanceCount = maintenanceState === 'ready' ? summary.attention : '—';
  return (
    <aside className="sidebar">
      <div className="sidebar-brand"><span className="brand-symbol"><Droplets size={22} strokeWidth={2.2} /></span><span className="brand-name">Smart<span>Water</span></span></div>
      <div className="scheme-switcher" aria-label="Selected water scheme">
        <span className="scheme-avatar">KW</span><span className="scheme-copy"><strong>Krishna Water Board</strong><small>North district</small></span><span className="scheme-chevron" aria-hidden="true">⌄</span>
      </div>
      <div className="nav-caption">WORKSPACE</div>
      <NavigationGroup items={primaryNavigation} lowStockCount={lowStockCount} maintenanceCount={maintenanceCount} />
      <div className="nav-caption nav-caption-secondary">PREFERENCES</div>
      <NavigationGroup items={secondaryNavigation} lowStockCount={lowStockCount} maintenanceCount={maintenanceCount} />
      <div className="sidebar-spacer" />
      <div className="support-card"><span className="support-icon"><LifeBuoy size={17} /></span><div><strong>Need a hand?</strong><span>Visit the help centre</span></div><span className="support-arrow">↗</span></div>
      <ConnectionStatus />
      <div className="sidebar-version">SMARTWATER <span>·</span> PHASE 2</div>
    </aside>
  );
}
