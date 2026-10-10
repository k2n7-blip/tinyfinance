import test from "node:test";
import assert from "node:assert/strict";
import { aiProviderMessage } from "../../lib/ai-errors";
test("AI errors distinguish credentials, permission, quota and temporary limits", () => {
  assert.match(aiProviderMessage(401), /Schlüssel wurde abgelehnt/);
  assert.match(aiProviderMessage(403), /Berechtigung/);
  assert.match(aiProviderMessage(429, "insufficient_quota"), /Guthaben/);
  assert.match(aiProviderMessage(429, "rate_limit_exceeded"), /Anfragelimit/);
  assert.match(aiProviderMessage(404, "model_not_found"), /Modell/);
});
test("AI error diagnostics never expose arbitrary provider text", () => {
  const untrusted = "private invoice content and API credential";
  for (const status of [400, 413, 500, 502]) {
    const message = aiProviderMessage(status, untrusted);
    assert.ok(!message.includes(untrusted));
    assert.ok(message.length > 0);
  }
});
