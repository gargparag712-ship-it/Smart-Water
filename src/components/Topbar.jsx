import { Bell, ChevronRight, Search } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { pageDetails } from '../data/navigation.js';

export default function Topbar() {
  const { pathname } = useLocation();
  const page = pageDetails.find((item) => item.path === pathname) ?? pageDetails[0];
  return (
    <header className="topbar">
        <div className="topbar-heading"><div className="breadcrumbs"><span>SMARTWATER</span><ChevronRight size={13} /><span>{(page.title ?? page.label).toUpperCase()}</span></div><h1>{page.title ?? page.label}</h1></div>
      <div className="topbar-actions">
        <label className="search-box"><Search size={17} aria-hidden="true" /><input type="search" placeholder="Search anything..." aria-label="Search anything" /><kbd>⌘ K</kbd></label>
        <button className="icon-button notification-button" type="button" aria-label="Notifications"><Bell size={19} strokeWidth={1.8} /><span className="notification-dot" /></button>
        <div className="topbar-divider" />
        <button className="profile-button" type="button" aria-label="Operator profile"><span className="profile-avatar">RK</span><span className="profile-copy"><strong>Ravi Kumar</strong><small>Scheme operator</small></span><span className="profile-chevron">⌄</span></button>
      </div>
    </header>
  );
}
