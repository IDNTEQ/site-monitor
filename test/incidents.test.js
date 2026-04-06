import test from "node:test";
import assert from "node:assert/strict";

import {
  acknowledgeIncident,
  autoResolveIncident,
  muteIncident,
  resolveIncident,
  unmuteIncident,
} from "../src/domain/incidents.js";
import { seedIncidents } from "../src/domain/seed.js";

function buildIncident() {
  return JSON.parse(JSON.stringify(seedIncidents[0]));
}

test("acknowledgeIncident records owner, note, and timestamp", () => {
  const incident = buildIncident();
  const next = acknowledgeIncident(incident, {
    actor: "Morgan Lee",
    note: "Investigating checkout database saturation.",
    at: "2026-04-06T09:15:00.000Z",
  });

  assert.equal(next.state, "acknowledged");
  assert.equal(next.owner, "Morgan Lee");
  assert.equal(next.acknowledgedAt, "2026-04-06T09:15:00.000Z");
  assert.equal(next.events[0].eventType, "acknowledged");
  assert.equal(next.events[0].note, "Investigating checkout database saturation.");
});

test("mute and unmute actions toggle alert delivery for active incidents", () => {
  const incident = buildIncident();
  const muted = muteIncident(incident, {
    actor: "Morgan Lee",
    note: "Noise suppressed while incident channel is active.",
    at: "2026-04-06T09:16:00.000Z",
  });
  const unmuted = unmuteIncident(muted, {
    actor: "Morgan Lee",
    note: "Resume paging after rollback validation.",
    at: "2026-04-06T09:20:00.000Z",
  });

  assert.equal(muted.alertsMuted, true);
  assert.equal(muted.events[0].eventType, "muted");
  assert.equal(unmuted.alertsMuted, false);
  assert.equal(unmuted.events[0].eventType, "unmuted");
});

test("manual resolution records operator metadata", () => {
  const incident = buildIncident();
  const resolved = resolveIncident(incident, {
    actor: "Morgan Lee",
    note: "Traffic is stable after the application restart.",
    at: "2026-04-06T09:31:00.000Z",
    source: "manual",
  });

  assert.equal(resolved.state, "resolved");
  assert.equal(resolved.resolvedAt, "2026-04-06T09:31:00.000Z");
  assert.equal(resolved.events[0].eventType, "resolved");
  assert.equal(resolved.events[0].actor, "Morgan Lee");
});

test("autoResolveIncident closes the incident after the recovery threshold is met", () => {
  const incident = buildIncident();
  const recovered = autoResolveIncident(incident, {
    at: "2026-04-06T09:42:00.000Z",
    recovered: true,
    consecutiveRecoveries: 2,
  });

  assert.equal(recovered.state, "resolved");
  assert.equal(recovered.events[0].eventType, "auto_resolved");
  assert.equal(recovered.events[0].actor, "site-monitor");
});

test("resolved incidents reject further manual actions", () => {
  const incident = resolveIncident(buildIncident(), {
    actor: "Morgan Lee",
    note: "",
    at: "2026-04-06T09:31:00.000Z",
    source: "manual",
  });

  assert.throws(
    () =>
      muteIncident(incident, {
        actor: "Morgan Lee",
        note: "",
        at: "2026-04-06T09:40:00.000Z",
      }),
    /resolved incident/,
  );
});
