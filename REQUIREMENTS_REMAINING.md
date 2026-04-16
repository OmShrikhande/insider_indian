# Requirements Remaining / Follow-ups

This file tracks pending items after the latest backend-first implementation pass.

## 1) F&O Data Completeness
- Integrate true OI and volume chain endpoints from Upstox for expiry/strike ladder.
- Replace provisional PCR logic (contract distribution proxy) with OI-based PCR.
- Add scheduled refresh job for F&O chain snapshots (per expiry).

## 2) Live Data Pipeline
- Add websocket/SSE fanout service for live quotes (instead of request-time passthrough only).
- Persist short-lived intraday cache (`latest_quotes`) for API fallback resilience.
- Add retry/circuit breaker for Upstox outage windows.

## 3) Quantum Alpha
- Add ranking model for confluence scoring (SMC + momentum + volatility + news sentiment).
- Add explainability payload (`why_this_signal`) for each recommendation.
- Add backtest metrics endpoint for each strategy template.

## 4) Alerts Engine
- Add background evaluator worker to trigger alerts continuously.
- Add delivery channels (in-app queue, webhook, email/telegram optional).
- Add de-duplication and cool-down windows.

## 5) Performance & Scale
- Add API rate limiter and per-route query budgets.
- Add server-side cache layer for expensive screener endpoints.
- Add pagination to all list APIs and bounded query windows by default.
- Add synthetic load tests and memory/latency SLO checks.

## 6) Security / Governance
- Add audit log table for admin-triggered sync calls.
- Rotate JWT secret policy and token revocation strategy.
- Add strict payload schema validation on all mutable endpoints.

## 7) UX / Product
- Add dedicated F&O panel with filter controls (underlying, expiry, option type).
- Add chart overlay snapping behavior and optional magnet mode.
- Add user-level preferences API (saved layouts, active studies, watchlist presets).
