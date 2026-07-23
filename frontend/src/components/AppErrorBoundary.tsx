import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props { children: ReactNode }
interface State { failed: boolean }

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError() { return { failed: true }; }

  componentDidCatch(_error: Error, _info: ErrorInfo) {}

  render() {
    if (this.state.failed) return <main className="app-error" role="alert"><h1>页面暂时无法加载</h1><p>请刷新页面后重试；任务数据不会因此被修改。</p></main>;
    return this.props.children;
  }
}
