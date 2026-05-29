---
phase: 02-core-ui-preset-management
plan: 02-02
subsystem: frontend
tags: [react, presets, joystick, tabs, ptz, keyboard]
provides:
  - TabBar component with Setup/Live navigation
  - PresetGrid with inline editing, toggle, drag reorder
  - Joystick with cross D-pad and keyboard shortcuts
  - SettingsPanel with system info
  - CameraSwitcher component
  - useKeyboard hook for global shortcuts
  - PTZ/preset API client functions
requires:
  - Phase 1 ACK pipeline (useWebSocket, useCommandState)
  - Plan 02-01 backend preset endpoints
  - Plan 02-03 backend PTZ movement endpoints
affects:
  - cloud/client/src/App.tsx
  - cloud/client/src/components/
  - cloud/client/src/pages/
  - cloud/client/src/hooks/
  - cloud/client/src/services/api.ts
tech-stack:
  added:
    - HTML5 drag-and-drop API (preset reorder)
    - Pointer Events API (press-and-hold joystick)
    - Keyboard event handling (global shortcuts)
  patterns:
    - ACK feedback (optimistic → confirm → revert)
    - Latest-command-wins
    - TDD (3 test files, 29 new tests)
key-files:
  created:
    - cloud/client/src/components/TabBar.tsx
    - cloud/client/src/components/SettingsPanel.tsx
    - cloud/client/src/components/CameraSwitcher.tsx
    - cloud/client/src/components/PresetGrid.tsx
    - cloud/client/src/components/Joystick.tsx
    - cloud/client/src/pages/Setup.tsx
    - cloud/client/src/pages/Live.tsx
    - cloud/client/src/hooks/useKeyboard.ts
    - cloud/client/src/__tests__/TabBar.test.tsx
    - cloud/client/src/__tests__/PresetGrid.test.tsx
    - cloud/client/src/__tests__/Joystick.test.tsx
  modified:
    - cloud/client/src/App.tsx
    - cloud/client/src/services/api.ts
decisions:
  - Tabs use ARIA role="tab" (not plain buttons) for accessibility
  - Drag reorder uses HTML5 native API with optimistic update + rollback
  - Joystick uses onPointerDown/Up for press-and-hold (not mousedown)
  - Keyboard shortcuts skip when focus is in input elements
  - Separate pan speed and zoom speed sliders (independent controls)
  - Preset card shows ptz_number as numeric badge (not "PTZ N" text)
duration:
  started: "2026-05-29T15:19:00Z"
  completed: "2026-05-29T15:28:00Z"
  total_minutes: 9
metrics:
  tasks: 3
  test_files: 9
  total_tests: 62
  new_tests: 29
  files_created: 11
  files_modified: 2
---

# Phase 2 Plan 2: Frontend — Setup/Live Tabs + Preset Grid + Joystick Summary

**One-liner:** Built the operator frontend with two-tab navigation (Setup/Live), 8-slot preset grid with inline editing and drag reorder, cross D-pad PTZ joystick with keyboard shortcuts (WASD/RT/FG/VB), camera switcher polish, and settings panel.

## Tasks Completed

### Task 1: Tab navigation + camera switcher + settings panel
- **Commit:** `4333daa`
- **Tests:** 9 new (TabBar.test.tsx)
- **Components:** TabBar, CameraSwitcher, SettingsPanel, Setup page, Live page
- **Details:** TabBar uses ARIA role="tab" with Setup active by default. Settings panel slides out with system info, closes on Escape/backdrop click. CameraSwitcher extracted from CommandPanel with large polished buttons.

### Task 2: Preset grid with inline editing and drag reorder
- **Commit:** `6278f76`
- **Tests:** 9 new (PresetGrid.test.tsx)
- **Components:** PresetGrid, API functions (getPresets, updatePreset, reorderPresets)
- **Details:** 8 vertical card list. Each card: drag grip handle, circular PTZ number badge, clickable name → inline input (Enter/blur saves), iOS-style toggle switch, number input for settle time. Drag-and-drop reorder with optimistic update + rollback. All operations call PUT/PATCH endpoints with ACK feedback.

### Task 3: PTZ joystick with keyboard shortcuts
- **Commit:** `a2ab435`
- **Tests:** 11 new (Joystick.test.tsx)
- **Components:** Joystick, useKeyboard hook, API functions (ptzMove, ptzZoom, ptzStop)
- **Details:** Cross D-pad layout (▲/▼/◀/▶) with center STOP. Zoom In/Out buttons to the right. Independent pan speed and zoom speed sliders (1-100). Press-and-hold via onPointerDown/Up with stop on release. Keyboard: WASD (pan/tilt), R/T (zoom), F/G (pan speed ±1), V/B (zoom speed ±1). Shortcut hints on buttons. Wired into Setup (prominent) and Live (collapsible details panel).

## Deviations from Plan

None - plan executed exactly as written.

## Test Results

| Suite | Tests | Status |
|-------|-------|--------|
| TabBar | 9 | ✅ |
| PresetGrid | 9 | ✅ |
| Joystick | 11 | ✅ |
| api (existing) | 12 | ✅ |
| CommandPanel (existing) | 6 | ✅ |
| StatusBar (existing) | 4 | ✅ |
| Toast (existing) | 3 | ✅ |
| useWebSocket (existing) | 4 | ✅ |
| Login (existing) | 4 | ✅ |
| **Total** | **62** | **All passing** |

## Self-Check: PASSED
