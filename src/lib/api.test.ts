import assert from "node:assert/strict";
import test from "node:test";
import { loadObservations } from "./api";

test("Observation loading scopes every page, discards partial failures and aborts", async (t) => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const originalStorage = Object.getOwnPropertyDescriptor(
    globalThis,
    "localStorage",
  );
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { CARE_API_URL: "https://care-api.example.test/" },
  });
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: { getItem: () => "test-token" },
  });
  t.after(() => {
    for (const [key, original] of [
      ["window", originalWindow],
      ["localStorage", originalStorage],
    ] as const) {
      if (original) Object.defineProperty(globalThis, key, original);
      else Reflect.deleteProperty(globalThis, key);
    }
  });
  let fail = false;
  let empty = false;
  const offsets: string[] = [];
  const fetchMock = t.mock.method(
    globalThis,
    "fetch",
    async (input: string, init: RequestInit) => {
      const url = new URL(input);
      assert.equal(url.origin, "https://care-api.example.test");
      assert.equal(url.pathname, "/api/v1/patient/patient-id/observation/");
      assert.equal(url.searchParams.get("encounter"), "encounter-id");
      assert.equal(url.searchParams.has("ignore_group"), false);
      assert.equal(url.searchParams.has("codes"), false);
      assert.equal(
        new Headers(init.headers).get("Authorization"),
        "Bearer test-token",
      );
      const offset = url.searchParams.get("offset")!;
      offsets.push(offset);
      if (offset === "1" && fail) return new Response(null, { status: 403 });
      return Response.json({
        count: 2,
        results: empty ? [] : [{ id: offset }],
      });
    },
  );
  const result = await loadObservations(
    "patient-id",
    "encounter-id",
    new AbortController().signal,
  );
  assert.deepEqual(offsets, ["0", "1"]);
  assert.deepEqual(
    result.map((entry) => entry.id),
    ["0", "1"],
  );
  fail = true;
  await assert.rejects(
    loadObservations(
      "patient-id",
      "encounter-id",
      new AbortController().signal,
    ),
    /403/,
  );
  fail = false;
  empty = true;
  await assert.rejects(
    loadObservations(
      "patient-id",
      "encounter-id",
      new AbortController().signal,
    ),
    /Incomplete/,
  );
  const before = fetchMock.mock.callCount();
  await assert.rejects(
    loadObservations("patient-id", "encounter-id", AbortSignal.abort()),
  );
  assert.equal(fetchMock.mock.callCount(), before);
});
