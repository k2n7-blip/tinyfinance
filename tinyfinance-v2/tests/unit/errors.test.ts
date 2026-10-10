import test from "node:test";
import assert from "node:assert/strict";
import { AppError, databaseError } from "../../lib/errors";
test("missing schema is a database setup failure, never a missing-key message", () => {
  for (const code of ["42P01", "42703", "PGRST202", "PGRST204", "PGRST205"]) {
    assert.throws(
      () => databaseError({ code, message: "internal database details" }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.status, 503);
        assert.equal(error.reason, "database");
        assert.match(error.message, /Migrationen/);
        assert.ok(!error.message.includes("internal"));
        return true;
      },
    );
  }
  assert.throws(
    () => databaseError({ code: "23505", message: "internal" }),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.status, 409);
      assert.equal(error.reason, undefined);
      return true;
    },
  );
});
