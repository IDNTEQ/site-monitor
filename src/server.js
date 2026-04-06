import { createApp } from "./http/app.js";
import { InMemoryMonitorRepository } from "./repositories/inMemoryMonitorRepository.js";
import { PolicyService } from "./services/policyService.js";

const port = Number(process.env.PORT ?? 3000);
const monitorRepository = new InMemoryMonitorRepository([
  {
    id: "monitor-checkout",
    name: "Checkout",
    alertPolicy: {
      failureThreshold: 3,
      recoveryThreshold: 2,
      notificationChannels: ["pagerduty", "slack"],
      escalationTarget: "payments-on-call",
      notifyOnRecovery: true
    },
    maintenanceWindows: []
  }
]);

const app = createApp({
  policyService: new PolicyService({ monitorRepository })
});

app.listen(port, () => {
  console.log(`site-monitor listening on port ${port}`);
});
