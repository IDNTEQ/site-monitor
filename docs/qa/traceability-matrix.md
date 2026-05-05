# Traceability Matrix -- site-monitor

> **Last updated:** 2026-05-05
> **Updated by:** Codex

## Requirements Traceability

| ID | Requirement | Issue | PR | Test File:Line | Staging Evidence | Status |
|----|-------------|-------|----|----------------|------------------|--------|
| REQ-001 | As a reliability engineer, I want to create and manage monitors so that important sites and endpoints are checked automatically. | [#1](https://github.com/IDNTEQ/site-monitor/issues/1) |  | `test/api.test.js:23`, `test/api.test.js:81`, `test/monitor-service.test.js:130`, `test/monitor-service.test.js:176`, `test/page-routes.test.js:90`, `test/page-routes.test.js:147` |  | Implemented |
| REQ-002 | As a reliability engineer, I want to configure alert policies and maintenance windows so that responders are notified only when failures are actionable. | [#2](https://github.com/IDNTEQ/site-monitor/issues/2) |  | `test/api.test.js:118`, `test/api.test.js:157`, `test/monitor-service.test.js:221`, `test/monitor-service.test.js:296`, `test/check-worker-service.test.js:378` |  | Implemented |
| REQ-003 | As an on-call responder, I want a dashboard of current monitor status and open incidents so that I can see what needs attention immediately. | [#3](https://github.com/IDNTEQ/site-monitor/issues/3) |  | `test/api.test.js:200`, `test/api.test.js:386`, `test/api.test.js:433`, `test/page-routes.test.js:19` |  | Implemented |
| REQ-004 | As an on-call responder, I want an incident timeline with failure evidence so that I can triage without searching raw logs elsewhere. | [#4](https://github.com/IDNTEQ/site-monitor/issues/4) |  | `test/api.test.js:534`, `test/monitor-service.test.js:572`, `test/page-routes.test.js:270` |  | Implemented |
| REQ-005 | As an on-call responder, I want to acknowledge, mute, and resolve incidents so that the team has clear operational ownership during an outage. | [#5](https://github.com/IDNTEQ/site-monitor/issues/5) |  | `test/api.test.js:628`, `test/monitor-service.test.js:732`, `test/monitor-service.test.js:820`, `test/check-worker-service.test.js:305` |  | Implemented |
| NFR-001 | Detection latency | [#6](https://github.com/IDNTEQ/site-monitor/issues/6) |  | `test/check-worker-service.test.js:27` |  | Implemented |
| NFR-002 | Check execution reliability | [#7](https://github.com/IDNTEQ/site-monitor/issues/7) |  | `test/check-worker-service.test.js:116`, `test/check-worker-service.test.js:196`, `test/api.test.js:480` |  | Partial |
| NFR-003 | Dashboard load time | [#8](https://github.com/IDNTEQ/site-monitor/issues/8) |  | `test/api.test.js:292`, `test/monitor-service.test.js:477` |  | Partial |
| NFR-004 | Accessibility | [#9](https://github.com/IDNTEQ/site-monitor/issues/9) |  | `test/page-routes.test.js:19`, `test/page-routes.test.js:147`, `test/page-routes.test.js:270` |  | Partial |
| NFR-005 | Secret handling | [#10](https://github.com/IDNTEQ/site-monitor/issues/10) |  | `test/api.test.js:45`, `test/monitor-service.test.js:46` |  | Implemented |
| NFR-006 | Auditability | [#11](https://github.com/IDNTEQ/site-monitor/issues/11) |  | `test/monitor-service.test.js:572`, `test/monitor-service.test.js:732`, `test/check-worker-service.test.js:116`, `test/sqlite-monitor-repository.test.js:6` |  | Partial |
| NFR-007 | Mobile support | [#12](https://github.com/IDNTEQ/site-monitor/issues/12) |  | `test/page-routes.test.js:19`, `test/page-routes.test.js:147`, `test/page-routes.test.js:270` |  | Partial |
