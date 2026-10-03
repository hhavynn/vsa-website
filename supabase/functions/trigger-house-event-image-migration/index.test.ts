import { handler } from "../_shared/server-test-adapter.ts";
import { defineImageMigrationWebhookTests } from "../_shared/image-migration-webhook-contract.ts";
import "./index.ts";

defineImageMigrationWebhookTests({
  label: "trigger-house-event-image-migration",
  handler,
  idField: "house_event_id",
  defaultEventType: "house-event-image-migration-requested",
  eventTypeEnv: "GITHUB_DISPATCH_EVENT_TYPE_HOUSE",
});
