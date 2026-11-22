import { Component } from 'react';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error('The application encountered an unexpected error.', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="system-message" role="alert">
          <h1>Something went wrong</h1>
          <p>Refresh the page to try again.</p>
        </main>
      );
    }
    return this.props.children;
  }
}
