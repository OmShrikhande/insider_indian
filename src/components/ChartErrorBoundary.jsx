import React from 'react';

class ChartErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error('Chart render error:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-full w-full flex items-center justify-center text-[#ff003c] font-mono text-xs">
          Chart crashed. Reload or switch symbol/timeframe.
        </div>
      );
    }

    return this.props.children;
  }
}

export default ChartErrorBoundary;
