import { Alert, Card, Space, Typography } from 'antd';
import { Navigate, Route, Routes } from 'react-router-dom';
import { MainLayout } from '@renderer/layouts/MainLayout';
import { CorrelationsPage } from '@renderer/pages/correlations/CorrelationsPage';
import { DashboardPage } from '@renderer/pages/dashboard/DashboardPage';
import { ImportCenterPage } from '@renderer/pages/imports/ImportCenterPage';
import { ImportLogsPage } from '@renderer/pages/import-logs/ImportLogsPage';
import { MarketingPage } from '@renderer/pages/marketing/MarketingPage';
import { ProductsPage } from '@renderer/pages/products/ProductsPage';
import { RefundsPage } from '@renderer/pages/refunds/RefundsPage';

function ComingSoonPage({ title }: { title: string }) {
  return (
    <Card className="panel-card">
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          {title}
        </Typography.Title>
        <Alert
          type="info"
          showIcon
          message="这个模块正在做稳定性收口"
          description="首页和导入主链已经在优先修复。这个页面会在后续轮次继续恢复。"
        />
      </Space>
    </Card>
  );
}

export function AppRouter() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/correlations" element={<CorrelationsPage />} />
        <Route path="/marketing" element={<MarketingPage />} />
        <Route path="/refunds" element={<RefundsPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/imports" element={<ImportCenterPage />} />
        <Route path="/import-logs" element={<ImportLogsPage />} />
      </Route>
    </Routes>
  );
}
