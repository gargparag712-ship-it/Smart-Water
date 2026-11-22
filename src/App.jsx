import { Navigate, Route, Routes } from 'react-router-dom';
import AppShell from './components/AppShell.jsx';
import AssetsPage from './pages/AssetsPage.jsx';
import InventoryPage from './pages/InventoryPage.jsx';
import MaintenancePage from './pages/MaintenancePage.jsx';
import FinancePage from './pages/FinancePage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import SuppliersPage from './pages/SuppliersPage.jsx';
import ReportsPage from './pages/ReportsPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import PlaceholderPage from './pages/PlaceholderPage.jsx';
import { pageDetails } from './data/navigation.js';

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/assets" element={<AssetsPage />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/maintenance" element={<MaintenancePage />} />
        <Route path="/finance" element={<FinancePage />} />
        <Route path="/suppliers" element={<SuppliersPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        {pageDetails.filter((page) => !['/', '/assets', '/inventory', '/maintenance', '/finance', '/suppliers', '/reports', '/settings'].includes(page.path)).map((page) => (
          <Route key={page.path} path={page.path} element={<PlaceholderPage page={page} />} />
        ))}
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
