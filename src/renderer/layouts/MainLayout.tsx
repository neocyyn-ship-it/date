import {
  BarChartOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  DotChartOutlined,
  ShoppingOutlined,
  UndoOutlined,
  UploadOutlined
} from '@ant-design/icons';
import { Layout, Menu, Typography } from 'antd';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

const { Header, Sider, Content } = Layout;

const menus = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: '经营总览' },
  { key: '/correlations', icon: <DotChartOutlined />, label: '相关性分析' },
  { key: '/marketing', icon: <BarChartOutlined />, label: '渠道营销' },
  { key: '/refunds', icon: <UndoOutlined />, label: '退款诊断' },
  { key: '/products', icon: <ShoppingOutlined />, label: '商品分析' },
  { key: '/imports', icon: <UploadOutlined />, label: '数据导入中心' },
  { key: '/import-logs', icon: <DatabaseOutlined />, label: '导入记录' }
];

export function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider width={240} theme="dark" style={{ background: 'linear-gradient(180deg, #0f172a 0%, #172554 100%)' }}>
        <div className="brand-panel">
          <Typography.Title level={4} style={{ color: '#fff', margin: 0 }}>
            经营分析工作台
          </Typography.Title>
          <Typography.Text style={{ color: 'rgba(255,255,255,0.65)' }}>本地 Excel 持续分析</Typography.Text>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menus}
          onClick={(info) => navigate(info.key)}
          style={{ background: 'transparent', borderInlineEnd: 0 }}
        />
      </Sider>
      <Layout>
        <Header className="top-header">
          <div>
            <Typography.Title level={3} style={{ margin: 0 }}>
              女装电商经营分析桌面应用
            </Typography.Title>
            <Typography.Text type="secondary">支持持续导入、周期替换、图片关联与半自助经营分析</Typography.Text>
          </div>
        </Header>
        <Content className="content-shell">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
