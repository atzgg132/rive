import assert from "node:assert/strict";
import test from "node:test";

import { migrationUploadHeaders } from "../../src/utils/migration/uploadContract.ts";

test("presigned migration uploads do not repeat query-signed object tags", () => {
  const headers = migrationUploadHeaders("text/csv");

  assert.deepEqual(headers, { "Content-Type": "text/csv" });
  assert.equal("x-amz-tagging" in headers, false);
});
