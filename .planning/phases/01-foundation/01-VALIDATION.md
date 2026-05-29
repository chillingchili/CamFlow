---
phase: 01
slug: foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-29
---

# Phase 01 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (unit/integration) + Playwright (E2E) |
| **Config file** | `vitest.config.ts` (per package), `playwright.config.ts` |
| **Quick run command** | `npx vitest run` |
| **Full suite command** | `npx vitest run && npx playwright test` |
| **Estimated runtime** | ~30 seconds (unit), ~90 seconds (full) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run`
- **After every plan wave:** Run `npx vitest run && npx playwright test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-task Verification Map

| task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | AUTH-01,02,03 | unit | `npx vitest run --reporter=verbose` | ❌ W0 | ⬜ pending |
| 01-01-02 | 01 | 1 | AUTH-01,02,03 | integration | `npx vitest run --reporter=verbose` | ❌ W0 | ⬜ pending |
| 01-02-01 | 02 | 2 | AGENT-02,05,06 | unit | `npx vitest run --reporter=verbose` | ❌ W0 | ⬜ pending |
| 01-02-02 | 02 | 2 | AGENT-03,04 | integration | `npx vitest run --reporter=verbose` | ❌ W0 | ⬜ pending |
| 01-03-01 | 03 | 3 | HWCTRL-01,02,03 | unit | `npx vitest run --reporter=verbose` | ❌ W0 | ⬜ pending |
| 01-03-02 | 03 | 3 | HWCTRL-01,02,03 | e2e | `npx playwright test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `cloud/server/src/__tests__/` — Vitest stubs for auth, tunnel, DB
- [ ] `agent/src/__tests__/` — Vitest stubs for tunnel, router, hardware modules
- [ ] `cloud/client/src/__tests__/` — Vitest stubs for UI components
- [ ] `e2e/` — Playwright stubs for login + command flows
- [ ] Install vitest in cloud/server, agent, and cloud/client packages

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Windows service install/uninstall | AGENT-01 | Requires Windows OS, admin privileges, actual service manager | Install agent service via `node service.js --install`, verify in `services.msc`, uninstall |
| OBS scene switch (real hardware) | HWCTRL-01 | Requires OBS running with WebSocket plugin, actual scenes | Open OBS, configure WebSocket, send `SetCurrentProgramScene` via agent, verify scene changes |
| PTZ preset recall (real hardware) | HWCTRL-02 | Requires BirdDog PTZ camera on network | Connect to actual camera, send NDI preset recall, verify physical movement |
| Tunnel reconnect (real network) | AGENT-02 | Requires cloud deployed + actual network conditions | Kill agent process, verify cloud detects stale, agent reconnects automatically |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
