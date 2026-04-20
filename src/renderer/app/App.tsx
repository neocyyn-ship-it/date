import { ConfigProvider, App as AntdApp, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { HashRouter } from 'react-router-dom';
import { AppRouter } from './router';

export function App() {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: '#1677ff',
          borderRadius: 10,
          fontFamily: '"Microsoft YaHei", "PingFang SC", sans-serif'
        }
      }}
    >
      <AntdApp>
        <HashRouter>
          <AppRouter />
        </HashRouter>
      </AntdApp>
    </ConfigProvider>
  );
}
