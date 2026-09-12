import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Git Instructor render error:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="error-boundary" role="alert">
          <h1>页面出错了</h1>
          <p>{this.state.error.message}</p>
          <p className="muted">可在下方重试，或清除本地进度后刷新。</p>
          <div className="error-actions">
            <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
              刷新页面
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                localStorage.removeItem('git-instructor:progress');
                window.location.reload();
              }}
            >
              清除进度并刷新
            </button>
          </div>
          <pre className="error-stack">{this.state.error.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}
