# Mobile Support QA Checklist

Issue: [#12](https://github.com/IDNTEQ/site-monitor/issues/12)

## Target

Validate that the dashboard and incident triage pages remain usable at 375px width and above.

## Manual QA

1. Open `index.html` at 375px width and confirm summary cards, filters, open incidents, and monitor cards fit without horizontal scrolling.
2. Toggle the mobile menu and the filter drawer on `index.html`; confirm both remain keyboard and touch reachable.
3. Apply each dashboard filter and confirm monitor cards update while the results count stays accurate.
4. Open `incident.html` at 375px width and confirm the action buttons stack cleanly above the evidence and timeline panels.
5. Trigger acknowledge, mute, and resolve actions on `incident.html`; confirm the state badge and timeline update without clipping or overlap.
6. Repeat the above at tablet and desktop widths to confirm the layout expands back to multi-column grids.
