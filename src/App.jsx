import { Navigate, Route, Routes } from 'react-router-dom';
import AppShell from './components/AppShell.jsx';
import AssetsPage from './pages/AssetsPage.jsx';
import InventoryPage from './pages/InventoryPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import PlaceholderPage from './pages/PlaceholderPage.jsx';
import { pageDetails } from './data/navigation.js';

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/assets" element={<AssetsPage />} />
        <Route path="/inventory" element={<InventoryPage />} />
        {pageDetails.filter((page) => page.path !== '/' && page.path !== '/assets' && page.path !== '/inventory').map((page) => (
          <Route key={page.path} path={page.path} element={<PlaceholderPage page={page} />} />
        ))}
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
