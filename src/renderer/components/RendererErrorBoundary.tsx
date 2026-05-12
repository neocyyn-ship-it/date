import { Alert, Button, Card, Space, Typography } from 'antd';
import type { ErrorInfo, ReactNode } from 'react';
import { Component } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class RendererErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    errorMessage: ''
  };

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error.message || 'Unknown renderer error'
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Renderer crashed:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24 }}>
          <Card>
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              <Typography.Title level={3} style={{ margin: 0 }}>
                页面渲染出错了
              </Typography.Title>
              <Alert
                type="error"
                showIcon
                message="应用界面加载失败"
                description={this.state.errorMessage || '请重新打开应用，或把当前页面截图发给我继续处理。'}
              />
              <Button type="primary" onClick={this.handleReload}>
                重新加载页面
              </Button>
            </Space>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
