import { handler } from "../_shared/server-test-adapter.ts";
import { defineImageMigrationWebhookTests } from "../_shared/image-migration-webhook-contract.ts";
import "./index.ts";

defineImageMigrationWebhookTests({
  label: "trigger-event-image-migration",
  handler,
  idField: "event_id",
  defaultEventType: "event-image-migration-requested",
  eventTypeEnv: "GITHUB_DISPATCH_EVENT_TYPE",
});
