import assert from "node:assert/strict";
import test from "node:test";

import { buildPagination, paginationOffset, parsePagination } from "../../src/lib/pagination.ts";

test("pagination requests clamp page size and reject unsafe values", () => {
  const params = new URLSearchParams("page=0&pageSize=999999999999999999999");
  assert.deepEqual(parsePagination(params), { page: 1, pageSize: 25 });
  assert.deepEqual(parsePagination(new URLSearchParams("page=2&pageSize=1000")), { page: 2, pageSize: 100 });
});

test("pagination metadata clamps a deleted or stale page to the last page", () => {
  const pagination = buildPagination(51, { page: 99, pageSize: 25 });
  assert.deepEqual(pagination, {
    page: 3,
    pageSize: 25,
    total: 51,
    totalPages: 3,
    hasNextPage: false,
    hasPreviousPage: true,
  });
  assert.equal(paginationOffset(pagination), 50);
});

test("empty collections expose no pages and start at page one", () => {
  const pagination = buildPagination(0, { page: 4, pageSize: 25 });
  assert.equal(pagination.page, 1);
  assert.equal(pagination.totalPages, 0);
  assert.equal(pagination.hasNextPage, false);
  assert.equal(pagination.hasPreviousPage, false);
});
