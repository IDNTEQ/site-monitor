# UX Specification -- site-monitor

## User Flows

### Create First Monitor

```mermaid
flowchart TD
    A[Dashboard] --> B[Create Monitor]
    B --> C[Enter URL, interval, thresholds]
    C --> D[Attach alert policy]
    D --> E[Save monitor]
    E --> F[Monitor detail]
```

### Triage Incident

```mermaid
flowchart TD
    A[Dashboard open incident badge] --> B[Incident detail]
    B --> C[Review timeline and recent checks]
    C --> D{Action needed?}
    D -->|Own it| E[Acknowledge with note]
    D -->|Suppress noise| F[Mute incident]
    D -->|Recovered| G[Resolve incident]
```

### Planned Maintenance

```mermaid
flowchart TD
    A[Monitor detail] --> B[Maintenance settings]
    B --> C[Set time window and reason]
    C --> D[Confirm suppression]
    D --> E[Window shown on dashboard and monitor detail]
```

## Key Screens

### Dashboard

**Purpose:** Give operators immediate visibility into overall service health, open incidents, and monitor state.
**Entry points:** Default authenticated route, logo navigation, incident action completion redirect.
**Key elements:**
- Status summary tiles
- Filterable monitor table
- Open incident list
- Quick actions for new monitor and saved filters

**States:**
- **Loading:** Skeleton tiles and table rows preserve layout.
- **Empty:** Zero-state explains that no monitors exist yet and offers a primary create action.
- **Error:** Full-width error panel with retry and latest known timestamp.
- **Populated:** Summary tiles, monitor rows, and open incidents render together with sticky filters.

**Accessibility notes:**
- Dashboard filters and row actions must be fully keyboard reachable.
- Status color is always paired with text labels and icon shape.
- Live incident count changes should use polite announcements, not interruptive focus shifts.

**Performance notes:**
- Initial dashboard payload should include only summary, first page of rows, and open incidents.
- Filters should update table content without full page reload and should remain responsive on low-end mobile devices.

**Wireframe:**

<div style="max-width:820px; margin:16px 0; border:2px solid #243447; border-radius:14px; overflow:hidden; background:#f7f8fb; font-family:Verdana, sans-serif">
  <div style="background:#243447; color:#fff; padding:12px 16px; display:flex; justify-content:space-between; align-items:center">
    <b>site-monitor</b>
    <span>Dashboard | Incidents | Monitors</span>
  </div>
  <div style="padding:16px; display:grid; gap:12px">
    <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:8px">
      <div style="background:#dff3e4; padding:12px; border-radius:8px">Healthy<br/>42</div>
      <div style="background:#fff2cc; padding:12px; border-radius:8px">Degraded<br/>3</div>
      <div style="background:#ffd9d6; padding:12px; border-radius:8px">Open incidents<br/>2</div>
      <div style="background:#e8eef8; padding:12px; border-radius:8px">Paused<br/>5</div>
    </div>
    <div style="background:#fff; border:1px solid #d6dbe3; border-radius:8px; padding:12px">Filters: environment | status | tag | incident state</div>
    <div style="display:grid; grid-template-columns:2fr 1fr; gap:12px">
      <div style="background:#fff; border:1px solid #d6dbe3; border-radius:8px; padding:12px">Monitor table with status, latency, last check, next run</div>
      <div style="background:#fff; border:1px solid #d6dbe3; border-radius:8px; padding:12px">Open incidents with age, severity, assignee, quick open</div>
    </div>
  </div>
</div>

Mobile wireframe (375px+):

<div style="max-width:380px; margin:16px 0; border:2px solid #243447; border-radius:24px; overflow:hidden; background:#f7f8fb; font-family:Verdana, sans-serif">
  <div style="background:#243447; color:#fff; padding:10px 14px; display:flex; justify-content:space-between; align-items:center">
    <b>site-monitor</b>
    <span>Menu</span>
  </div>
  <div style="padding:14px; display:grid; gap:10px">
    <div style="background:#dff3e4; padding:10px; border-radius:8px">Healthy 42</div>
    <div style="background:#ffd9d6; padding:10px; border-radius:8px">Open incidents 2</div>
    <div style="background:#fff; border:1px solid #d6dbe3; border-radius:8px; padding:10px">Compact filters</div>
    <div style="background:#fff; border:1px solid #d6dbe3; border-radius:8px; padding:10px">Incident cards</div>
    <div style="background:#fff; border:1px solid #d6dbe3; border-radius:8px; padding:10px">Monitor cards</div>
  </div>
</div>

### Monitor Detail and Edit

**Purpose:** Show a single monitor's configuration, recent behavior, and change surfaces.
**Entry points:** Dashboard row click, post-create redirect, incident detail backlink.
**Key elements:**
- Header with current state and last check
- Configuration form
- Alert policy summary
- Recent check history chart and table

**States:**
- **Loading:** Preserve header and panel dimensions with skeleton blocks.
- **Empty:** Only relevant for a newly created monitor with no checks yet; explain when first run will occur.
- **Error:** Inline error for failed data fetch or failed save, with retry and unsaved-change retention.
- **Populated:** Form, status metadata, and history render in a two-column desktop layout.

**Accessibility notes:**
- Form validation errors must be associated to their fields and summarized at top on submit.
- Pause, resume, and archive actions require button text that describes the current effect.
- History chart needs a tabular alternative.

**Performance notes:**
- Recent check history can load progressively after the core monitor record.
- Save actions should show optimistic button state but not fake incident or check history.

**Wireframe:**

<div style="max-width:820px; margin:16px 0; border:2px solid #2c3e50; border-radius:14px; overflow:hidden; background:#fbfbfd; font-family:Verdana, sans-serif">
  <div style="background:#2c3e50; color:#fff; padding:12px 16px">
    <b>Monitor Detail</b> | checkout.example.com | Degraded
  </div>
  <div style="padding:16px; display:grid; grid-template-columns:1.4fr 1fr; gap:12px">
    <div style="background:#fff; border:1px solid #d6dbe3; border-radius:8px; padding:12px">Config form: URL, method, interval, timeout, keyword, tags</div>
    <div style="display:grid; gap:12px">
      <div style="background:#fff; border:1px solid #d6dbe3; border-radius:8px; padding:12px">Status summary and next run</div>
      <div style="background:#fff; border:1px solid #d6dbe3; border-radius:8px; padding:12px">Alert policy and maintenance window</div>
    </div>
    <div style="grid-column:1 / span 2; background:#fff; border:1px solid #d6dbe3; border-radius:8px; padding:12px">Recent check chart and table</div>
  </div>
</div>

Mobile wireframe (375px+):

<div style="max-width:380px; margin:16px 0; border:2px solid #2c3e50; border-radius:24px; overflow:hidden; background:#fbfbfd; font-family:Verdana, sans-serif">
  <div style="background:#2c3e50; color:#fff; padding:10px 14px">
    <b>Monitor Detail</b>
  </div>
  <div style="padding:14px; display:grid; gap:10px">
    <div style="background:#fff; border:1px solid #d6dbe3; border-radius:8px; padding:10px">Status summary</div>
    <div style="background:#fff; border:1px solid #d6dbe3; border-radius:8px; padding:10px">Config form stack</div>
    <div style="background:#fff; border:1px solid #d6dbe3; border-radius:8px; padding:10px">Alert policy and maintenance</div>
    <div style="background:#fff; border:1px solid #d6dbe3; border-radius:8px; padding:10px">Recent checks list</div>
  </div>
</div>

### Incident Detail

**Purpose:** Let the on-call responder understand what failed, what has happened since, and what action to take.
**Entry points:** Dashboard incident list, incident deep link from notification, monitor detail incident history.
**Key elements:**
- Incident header with state, age, and action buttons
- Timeline of incident and operator events
- Recent failed and recovered checks
- Notification delivery history

**States:**
- **Loading:** Header and timeline skeletons keep action area stable.
- **Empty:** Not applicable once an incident exists; if the record was deleted, show not-found guidance.
- **Error:** Inline error with retry and fallback link to dashboard.
- **Populated:** Header, evidence panels, and timeline render with sticky action controls on desktop.

**Accessibility notes:**
- Action buttons need explicit labels such as "Acknowledge incident" and "Mute alerts for this incident".
- The timeline order must be readable in source order for screen readers.
- Delivery status chips require text equivalents, not color only.

**Performance notes:**
- Incident evidence can paginate older timeline events after the first screen.
- Actions should return quickly and append events without forcing a full refetch where possible.

**Wireframe:**

<div style="max-width:820px; margin:16px 0; border:2px solid #5b2c6f; border-radius:14px; overflow:hidden; background:#fdf8ff; font-family:Verdana, sans-serif">
  <div style="background:#5b2c6f; color:#fff; padding:12px 16px; display:flex; justify-content:space-between; align-items:center">
    <b>Incident INC-204</b>
    <span>Acknowledge | Mute | Resolve</span>
  </div>
  <div style="padding:16px; display:grid; grid-template-columns:1.6fr 1fr; gap:12px">
    <div style="background:#fff; border:1px solid #dfd2e6; border-radius:8px; padding:12px">Timeline: opened, notifications sent, acknowledged, recovered</div>
    <div style="display:grid; gap:12px">
      <div style="background:#fff; border:1px solid #dfd2e6; border-radius:8px; padding:12px">Incident summary and latest check evidence</div>
      <div style="background:#fff; border:1px solid #dfd2e6; border-radius:8px; padding:12px">Delivery history</div>
    </div>
  </div>
</div>

Mobile wireframe (375px+):

<div style="max-width:380px; margin:16px 0; border:2px solid #5b2c6f; border-radius:24px; overflow:hidden; background:#fdf8ff; font-family:Verdana, sans-serif">
  <div style="background:#5b2c6f; color:#fff; padding:10px 14px">
    <b>Incident INC-204</b>
  </div>
  <div style="padding:14px; display:grid; gap:10px">
    <div style="background:#fff; border:1px solid #dfd2e6; border-radius:8px; padding:10px">Action buttons stack</div>
    <div style="background:#fff; border:1px solid #dfd2e6; border-radius:8px; padding:10px">Summary and latest check</div>
    <div style="background:#fff; border:1px solid #dfd2e6; border-radius:8px; padding:10px">Timeline list</div>
    <div style="background:#fff; border:1px solid #dfd2e6; border-radius:8px; padding:10px">Delivery history</div>
  </div>
</div>
