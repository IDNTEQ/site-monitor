const incidentId = window.location.pathname.split("/").pop() || "inc-204";

const actionConfig = {
  acknowledge: {
    title: "Acknowledge incident",
    description: "Record who owns this incident and include an optional triage note.",
    submitLabel: "Acknowledge incident",
  },
  mute: {
    title: "Mute alerts for this incident",
    description: "Suppress repeated alert delivery while the team works the outage.",
    submitLabel: "Mute alerts",
  },
  unmute: {
    title: "Unmute alerts for this incident",
    description: "Resume alert delivery for this active incident.",
    submitLabel: "Unmute alerts",
  },
  resolve: {
    title: "Resolve incident",
    description: "Close the incident manually when the outage is handled.",
    submitLabel: "Resolve incident",
  },
};

const state = {
  selectedAction: "acknowledge",
  incident: null,
};

const elements = {
  title: document.querySelector("#incident-title"),
  state: document.querySelector("#incident-state"),
  monitorName: document.querySelector("#monitor-name"),
  environment: document.querySelector("#monitor-environment"),
  owner: document.querySelector("#incident-owner"),
  mute: document.querySelector("#incident-mute"),
  acknowledgeButton: document.querySelector("#acknowledge-button"),
  muteButton: document.querySelector("#mute-button"),
  resolveButton: document.querySelector("#resolve-button"),
  form: document.querySelector("#action-form"),
  formTitle: document.querySelector("#form-title"),
  formDescription: document.querySelector("#form-description"),
  submitButton: document.querySelector("#submit-button"),
  actorInput: document.querySelector("#actor-input"),
  noteInput: document.querySelector("#note-input"),
  formStatus: document.querySelector("#form-status"),
  timelineList: document.querySelector("#timeline-list"),
  checkOutcome: document.querySelector("#check-outcome"),
  checkStatusCode: document.querySelector("#check-status-code"),
  checkLatency: document.querySelector("#check-latency"),
  checkRule: document.querySelector("#check-rule"),
  deliveryList: document.querySelector("#delivery-list"),
};

function formatTimestamp(value) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}

function sentenceCase(value) {
  return value.replaceAll("_", " ");
}

function renderTimeline(events) {
  elements.timelineList.innerHTML = events
    .map(
      (event) => `
        <li class="timeline-item">
          <div class="timeline-marker"></div>
          <div class="timeline-copy">
            <div class="timeline-heading">
              <strong>${sentenceCase(event.eventType)}</strong>
              <span>${formatTimestamp(event.createdAt)}</span>
            </div>
            <p>Actor: ${event.actor}</p>
            <p>${event.note || "No note added."}</p>
          </div>
        </li>
      `,
    )
    .join("");
}

function renderDeliveryHistory(deliveries) {
  elements.deliveryList.innerHTML = deliveries
    .map(
      (delivery) => `
        <li>
          <strong>${delivery.channel}</strong>
          <span>${delivery.status}</span>
          <small>${formatTimestamp(delivery.sentAt)}</small>
        </li>
      `,
    )
    .join("");
}

function syncActionControls() {
  const incident = state.incident;
  const isResolved = incident.state === "resolved";
  const nextMuteAction = incident.alertsMuted ? "unmute" : "mute";
  const muteConfig = actionConfig[nextMuteAction];
  const selectedConfig = actionConfig[state.selectedAction];

  elements.state.textContent = sentenceCase(incident.state);
  elements.state.dataset.state = incident.state;
  elements.owner.textContent = incident.owner || "Unassigned";
  elements.mute.textContent = incident.alertsMuted ? "Muted" : "Live";
  elements.acknowledgeButton.disabled = isResolved;
  elements.resolveButton.disabled = isResolved;
  elements.muteButton.disabled = isResolved;
  elements.submitButton.disabled = isResolved;
  elements.muteButton.textContent = muteConfig.title;
  elements.formTitle.textContent = selectedConfig.title;
  elements.formDescription.textContent = selectedConfig.description;
  elements.submitButton.textContent = selectedConfig.submitLabel;
}

function renderIncident(incident) {
  state.incident = incident;
  if (
    state.selectedAction === "mute" &&
    incident.alertsMuted
  ) {
    state.selectedAction = "unmute";
  } else if (
    state.selectedAction === "unmute" &&
    !incident.alertsMuted
  ) {
    state.selectedAction = "mute";
  }

  elements.title.textContent = incident.id.toUpperCase();
  elements.monitorName.textContent = incident.monitor.name;
  elements.environment.textContent = incident.monitor.environment;
  elements.checkOutcome.textContent = incident.latestCheck.outcome;
  elements.checkStatusCode.textContent = String(incident.latestCheck.statusCode);
  elements.checkLatency.textContent = `${incident.latestCheck.responseTimeMs} ms`;
  elements.checkRule.textContent = incident.latestCheck.ruleResult;

  syncActionControls();
  renderTimeline(incident.events);
  renderDeliveryHistory(incident.deliveryHistory);
}

async function loadIncident() {
  const response = await fetch(`/api/incidents/${incidentId}`);
  const incident = await response.json();

  if (!response.ok) {
    throw new Error(incident.error);
  }

  renderIncident(incident);
}

function setSelectedAction(action) {
  state.selectedAction = action;
  syncActionControls();
  elements.formStatus.textContent = "";
}

elements.acknowledgeButton.addEventListener("click", () =>
  setSelectedAction("acknowledge"),
);
elements.muteButton.addEventListener("click", () =>
  setSelectedAction(state.incident.alertsMuted ? "unmute" : "mute"),
);
elements.resolveButton.addEventListener("click", () =>
  setSelectedAction("resolve"),
);

elements.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  elements.submitButton.disabled = true;
  elements.formStatus.textContent = "Submitting action...";

  const response = await fetch(`/api/incidents/${incidentId}/actions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: state.selectedAction,
      actor: elements.actorInput.value,
      note: elements.noteInput.value,
    }),
  });

  const payload = await response.json();
  elements.submitButton.disabled = false;

  if (!response.ok) {
    elements.formStatus.textContent = payload.error;
    return;
  }

  elements.noteInput.value = "";
  elements.formStatus.textContent = `${actionConfig[state.selectedAction].submitLabel} recorded at ${formatTimestamp(payload.events[0].createdAt)}.`;
  renderIncident(payload);
});

loadIncident().catch((error) => {
  elements.formStatus.textContent = error.message;
});
