# Knowledge Tree -- site-monitor

## Executive Research Summary

- `site-monitor` appears to be a newly created repository for a site monitoring service, but the current working tree contains no implementation or planning files.
- The only concrete intake signal available locally says a core monitoring worker prototype was initialized and that the next planned steps are database schema design, alerting, and CI/CD.
- Because GitHub board `11` could not be read from this sandboxed session, planning is based on repo inspection plus the local memory note and should be treated as a reviewable draft.
- The recommended MVP is an internal uptime monitoring service with a web console, scheduled checks, incident tracking, and operator alerting.
- The highest current risk is scope drift between this planning set and any inaccessible GitHub board state or uncommitted prototype work that is not present in the repo.

## DOK 1-2: Facts and Sources

### Domain Overview

`site-monitor` is planned as a reliability tool for engineering and on-call users who need fast visibility into whether important web endpoints are healthy. The initial product definition should optimize for deterministic health checks, clear incident timelines, and actionable alerting rather than broad observability or synthetic testing depth.

### Glossary

| Term | Definition |
|------|-----------|
| Monitor | A configured endpoint or site check that runs on a schedule. |
| Check result | A single execution record containing response status, timing, and pass/fail outcome. |
| Incident | A grouped period of monitor failure that is visible to operators until resolved. |
| Alert policy | Rules that determine who gets notified, through which channel, and under what conditions. |
| Maintenance window | A time range during which failures are suppressed or treated as non-actionable. |

### Key Facts

| Fact | Source | Confidence |
|------|--------|-----------|
| The current repository working tree is empty except for `.git`. | Local repo inspection on 2026-04-06 | High |
| A GitHub repo named `site-monitor` was created successfully on 2026-04-06. | `../memory/2026-04-06.md` | High |
| A core monitoring worker prototype was initialized before this planning pass. | `../memory/2026-04-06.md` | Medium |
| Planned next steps already identified elsewhere are database schema design, alerting, and CI/CD pipeline configuration. | `../memory/2026-04-06.md` | High |
| GitHub project board metadata could not be read from this session because `gh` config access is blocked by the filesystem sandbox. | CLI attempt on 2026-04-06 | High |

### Technology Landscape

| Option | Pros | Cons | Recommendation |
|--------|------|------|---------------|
| Single Node.js/TypeScript service with an embedded scheduler | Fastest path to MVP, low deployment complexity, easy local development | Scheduler and API scaling are coupled | Maybe |
| Split API service plus background worker backed by Postgres | Cleaner separation between operator traffic and check execution, easier to reason about incidents and retries | Slightly higher deployment and orchestration overhead | Yes |
| Fully serverless scheduled checks | Minimal server management, can scale per check | Harder local debugging, more fragmented incident logic, provider-specific constraints | No for MVP |
| Outsource monitoring entirely to a third-party SaaS | Fastest operational outcome | Not aligned with a repo-backed product build, limited control over roadmap and data model | No |

### Constraints

- Planning must stop short of implementation and issue creation until the Executive Brief is approved or auto-started.
- Planning is operating with incomplete source context because the repo does not currently contain the referenced prototype.
- GitHub project board `11` was requested for review but is not accessible from this sandboxed session.
- The product definition needs to stay narrow enough that it can plausibly be implemented from an empty repo without hidden complexity.

## DOK 3: Insights and Analysis

### Cross-Referenced Insights

The available evidence points to a backend-first product whose value comes from reliable check execution and usable incident handling. Because the current repo is empty, the safest interpretation is that the MVP should focus on a thin but complete loop: define monitors, run checks, group failures into incidents, notify operators, and present status in a web console. Anything beyond that, such as public status pages, scripted browser journeys, or broad analytics, would be speculative scope expansion unsupported by the intake record.

### Competitive / Reference Analysis

| Reference | What They Do Well | What They Miss | Relevance |
|-----------|-------------------|---------------|-----------|
| Hosted uptime monitoring tools | Fast monitor setup, clear status dashboards, basic incident alerting | Less control over data model, alert policy logic, and internal integration | High |
| Internal cron plus chat alert bots | Cheap to start, operationally familiar | Weak operator UX, fragmented incident history, poor auditability | High |
| Full observability suites | Deep telemetry and alert routing | Too broad and expensive in scope for this repo state | Medium |

### Tradeoffs

| Decision | Option A | Option B | Recommendation |
|----------|----------|----------|---------------|
| Runtime shape | Single deployable app | Split API plus worker | Split API plus worker |
| Monitoring depth | Simple HTTP checks | Multi-step synthetic journeys | Simple HTTP checks for MVP |
| Incident policy | Alert on every failed check | Open incidents after configurable failure threshold | Threshold-based incident opening |
| Operator scope | Team-internal admin and on-call views | Multi-tenant SaaS control plane | Team-internal views only |

## DOK 4: Spiky POVs

### MVP should not chase synthetic monitoring

**Claim:** The first release should treat site monitoring as deterministic scheduled HTTP health checks, not browser automation.
**Evidence for:** The available intake signal names worker, database, alerting, and CI/CD, which all align with a service health MVP.
**Evidence against:** Browser-based flows can catch failures simple HTTP checks miss.
**Our position:** Exclude synthetic scripts from MVP and define an extension path later.

### Alert quality matters more than dashboard polish

**Claim:** The system earns trust by opening the right incidents and sending the right alerts, even if the first dashboard is utilitarian.
**Evidence for:** On-call users need actionability first; an empty repo means backend correctness is the primary delivery risk.
**Evidence against:** Poor operator UX can slow triage.
**Our position:** Build a clear operator console, but prioritize check execution, incident grouping, and notification correctness over visual depth.
