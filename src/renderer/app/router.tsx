import { Navigate, Route, Routes } from 'react-router-dom';
import { MainLayout } from '@renderer/layouts/MainLayout';
import { DashboardPage } from '@renderer/pages/dashboard/DashboardPage';
import { MarketingPage } from '@renderer/pages/marketing/MarketingPage';
import { RefundsPage } from '@renderer/pages/refunds/RefundsPage';
import { ProductsPage } from '@renderer/pages/products/ProductsPage';
import { ImportCenterPage } from '@renderer/pages/imports/ImportCenterPage';
import { ImportLogsPage } from '@renderer/pages/import-logs/ImportLogsPage';

export function AppRouter() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/marketing" element={<MarketingPage />} />
        <Route path="/refunds" element={<RefundsPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/imports" element={<ImportCenterPage />} />
        <Route path="/import-logs" element={<ImportLogsPage />} />
      </Route>
    </Routes>
  );
}
