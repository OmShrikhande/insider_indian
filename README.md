# ProTrader: Advanced Indian Stock Analysis Dashboard

A premium, high-performance stock analysis dashboard built for Indian markets, featuring real-time data visualization, predictive intelligence, and a "top-secret" ProTrader aesthetic.

## 🚀 Key Features

- **Pure Black Interface**: Optimized for high-contrast trading in low-light environments.
- **Advanced Charting**: Powered by `lightweight-charts` with real-time updates.
- **Indicators**:
  - **SMA (20)**: Simple Moving Average for trend analysis.
  - **RSI (14)**: Relative Strength Index in a dedicated sub-pane for momentum tracking.
- **Predictive Signals**: Specialized "Futuristic Trades" panel with confidence scores.
- **Intelligence Feed**: Real-time market news and sentiment analysis.
- **Deep Data Integration**: Supports multiple timeframes (`1m`, `5m`, `15m`, `1h`, `1d`) pulled directly from ClickHouse.

## ⌨️ Shortcuts

- **Type Anywhere**: Simply start typing any symbol name (e.g., "AAPL") to instantly trigger the search modal.
- **`/`**: Manual focus on the symbol search bar.
- **Esc**: Clear search or close dropdowns.

## 🛠️ Technology Stack

- **Frontend**: React 19, Vite, Tailwind CSS, Lightweight Charts.
- **Backend**: Node.js, Express 5.
- **Database**: ClickHouse (OLAP) for high-speed time-series data.

## 📂 Project Structure

- `/src/components`: UI components (Dashboard, Chart, Sidebar, etc.)
- `/src/hooks`: Custom React hooks for data fetching.
- `/src/services`: API client for backend communication.
- `/backend/services`: ClickHouse query logic and data processing.
- `/backend/routes`: RESTful API endpoints.

## 🚦 Getting Started

1. **Prerequisites**: Ensure ClickHouse is running on Docker (`localhost:8123`).
2. **Backend**:
   ```bash
   cd backend
   npm install
   npm run dev
   ```
3. **Frontend**:
   ```bash
   npm install
   npm run dev
   ```

---
**SECURE UPLINK ESTABLISHED | ENCRYPTED | NOMINAL**
