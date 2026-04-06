const menuToggle = document.querySelector("[data-menu-toggle]");
const menu = document.querySelector("[data-menu]");

if (menuToggle && menu) {
  menuToggle.addEventListener("click", () => {
    const expanded = menuToggle.getAttribute("aria-expanded") === "true";
    menuToggle.setAttribute("aria-expanded", String(!expanded));
    menu.classList.toggle("is-open", !expanded);
  });
}

const filtersToggle = document.querySelector("[data-filters-toggle]");
const filters = document.querySelector("[data-filters]");

if (filtersToggle && filters) {
  filtersToggle.addEventListener("click", () => {
    const expanded = filtersToggle.getAttribute("aria-expanded") === "true";
    filtersToggle.setAttribute("aria-expanded", String(!expanded));
    filters.classList.toggle("is-open", !expanded);
  });
}

const monitorList = document.querySelector("[data-monitor-list]");
const resultsCount = document.querySelector("[data-results-count]");

if (monitorList && filters) {
  const applyFilters = () => {
    const formData = new FormData(filters);
    const rules = {
      environment: formData.get("environment"),
      status: formData.get("status"),
      incident: formData.get("incident"),
    };

    let visibleCount = 0;

    for (const card of monitorList.children) {
      const matches = Object.entries(rules).every(([key, value]) => {
        if (!value || value === "all") {
          return true;
        }

        return card.dataset[key] === value;
      });

      card.classList.toggle("is-hidden", !matches);

      if (matches) {
        visibleCount += 1;
      }
    }

    if (resultsCount) {
      const noun = visibleCount === 1 ? "monitor" : "monitors";
      resultsCount.textContent = `Showing ${visibleCount} ${noun}`;
    }
  };

  filters.addEventListener("change", applyFilters);
  filters.addEventListener("reset", () => {
    window.setTimeout(applyFilters, 0);
  });
}

const incidentBadge = document.querySelector("[data-incident-state-badge]");
const deliveryState = document.querySelector("[data-delivery-state]");
const responder = document.querySelector("[data-responder]");
const noteField = document.querySelector("[data-note]");
const timeline = document.querySelector("[data-timeline]");

const appendTimelineEvent = (title, detail) => {
  if (!timeline) {
    return;
  }

  const item = document.createElement("li");
  item.className = "timeline-item";

  const time = new Date().toISOString().slice(11, 16);

  item.innerHTML = `
    <span class="timeline-time">${time} UTC</span>
    <div>
      <h3>${title}</h3>
      <p>${detail}</p>
    </div>
  `;

  timeline.prepend(item);
};

document.querySelectorAll("[data-action]").forEach((button) => {
  button.addEventListener("click", () => {
    const note = noteField?.value.trim() || "No note supplied.";

    switch (button.dataset.action) {
      case "acknowledge":
        if (incidentBadge) {
          incidentBadge.textContent = "Acknowledged";
          incidentBadge.className = "pill pill-degraded";
        }

        if (responder) {
          responder.textContent = "Primary on-call";
        }

        appendTimelineEvent("Incident acknowledged", note);
        break;
      case "mute":
        if (deliveryState) {
          deliveryState.textContent = "muted";
        }

        appendTimelineEvent("Alerts muted", note);
        break;
      case "resolve":
        if (incidentBadge) {
          incidentBadge.textContent = "Resolved";
          incidentBadge.className = "pill pill-healthy";
        }

        appendTimelineEvent("Incident resolved", note);
        break;
      default:
        break;
    }
  });
});
