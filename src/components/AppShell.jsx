import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import Topbar from './Topbar.jsx';

export default function AppShell() {
  return <div className="app-frame"><Sidebar /><div className="workspace"><Topbar /><main className="main-content"><Outlet /></main></div></div>;
}
