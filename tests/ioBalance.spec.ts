import type { Question } from "@/types/questionnaire/question";
import { expect, test } from "../../../node_modules/@playwright/test/index.mjs";
import { readFile } from "node:fs/promises";
import { createQuestionnaireEncounter } from "../../../tests/helper/questionnaire";
import {
  addTopLevelQuestion,
  createQuestionnaireAndOpenBuilder,
} from "../../../tests/helper/questionnaireV2";
import { getFacilityId } from "../../../tests/support/facilityId";

// Run with apps/care_io_balance_fe/playwright.config.ts against the local backend.
test("multiple I/O entries persist as coded panel components on the existing backend", async ({
  page,
  request,
}) => {
  const api = process.env.REACT_CARE_API_URL ?? "http://localhost:9000";
  const auth = JSON.parse(await readFile("tests/.auth/user.json", "utf8"));
  const storage = auth.origins[0].localStorage as {
    name: string;
    value: string;
  }[];
  const token = storage.find(
    (item) => item.name === "care_access_token",
  )!.value;
  const headers = { Authorization: `Bearer ${token}` };
  await page.addInitScript((items) => {
    for (const item of items) localStorage.setItem(item.name, item.value);
  }, storage);
  const facilityId = getFacilityId();
  const { patientId, encounterId } =
    await createQuestionnaireEncounter(facilityId);
  const detailUrl = await createQuestionnaireAndOpenBuilder(page, {
    basePath: `/facility/${facilityId}/settings/questionnaires`,
    title: `I/O browser ${Date.now()}`,
    status: "Active",
  });
  const questionnaireKey = detailUrl.split("/").at(-1)!;
  await expect(
    page.getByRole("button", { name: "Add First Question" }),
  ).toBeVisible();
  await addTopLevelQuestion(page, "Intake / output balance");
  await page
    .getByRole("combobox", { name: "Question Type", exact: true })
    .click();
  await page.locator('[data-slot="command-item"][data-value="group"]').click();
  await page
    .getByRole("option", { name: "Intake / output balance", exact: true })
    .click();
  await page
    .getByRole("checkbox", { name: "Require at least one entry", exact: true })
    .check();
  const saveDefinition = page.waitForResponse(
    (response) =>
      response.url().includes("/api/v1/questionnaire/") &&
      response.request().method() === "PUT",
  );
  await page.getByRole("button", { name: /^Save Changes/ }).click();
  const savedDefinition = await saveDefinition;
  expect(savedDefinition.ok(), await savedDefinition.text()).toBeTruthy();
  const group = (await savedDefinition.json()).questions[0];
  expect(group).toMatchObject({
    repeats: true,
    required: true,
    structured_type: "care_io_balance_fe.io_balance",
  });
  expect(group.is_component).toBe(true);
  expect(group.questions).toHaveLength(15); // 9 coded volumes and 6 context fields
  await page.reload();
  await expect(
    page.getByRole("checkbox", {
      name: "Require at least one entry",
      exact: true,
    }),
  ).toBeChecked();
  await expect(
    page.getByRole("button", { name: "Repair schema", exact: true }),
  ).toHaveCount(0);
  const reloaded = await request.get(
    `${api}/api/v1/questionnaire/${questionnaireKey}/`,
    { headers },
  );
  expect(reloaded.ok()).toBeTruthy();
  const savedGroup = (await reloaded.json()).questions[0];
  expect(
    savedGroup.questions.find(
      (q: Question) => q.link_id === `${group.link_id}__urine`,
    ).code.code,
  ).toBe("9187-6");
  await page.goto(
    `/facility/${facilityId}/patient/${patientId}/encounter/${encounterId}/questionnaire/${questionnaireKey}`,
  );
  const chart = page.locator(".care-io-balance-fe");
  await expect(chart).toBeVisible();
  await expect(chart.locator(".io-new-entry")).toHaveCount(2);
  await expect(chart.locator(".io-entry")).toHaveCount(0);
  await expect(
    chart.getByRole("button", { name: /Add intake|Add output/ }),
  ).toHaveCount(0);

  await chart
    .getByRole("row", { name: "New intake entry", exact: true })
    .getByRole("spinbutton", { name: "Volume (mL)" })
    .fill("0");
  const first = chart.getByRole("row", { name: "Entry 1", exact: true });
  await first.getByRole("spinbutton", { name: "Volume (mL)" }).fill("250");
  await first.getByRole("button", { name: "Show optional fields" }).click();
  await first
    .locator('input[type="datetime-local"]')
    .first()
    .fill("2026-09-28T08:15");
  await expect(
    first.getByRole("textbox", { name: "Details (optional)" }),
  ).toBeVisible();
  await first
    .getByRole("textbox", { name: "Details (optional)" })
    .fill("Water");
  await first.getByRole("button", { name: "Hide optional fields" }).click();
  await expect(
    first.getByRole("textbox", { name: "Details (optional)" }),
  ).toBeVisible();
  await chart
    .getByRole("row", { name: "New output entry", exact: true })
    .getByRole("spinbutton", { name: "Volume (mL)" })
    .fill("0");
  const second = chart.getByRole("row", { name: "Entry 2", exact: true });
  await second.getByRole("spinbutton", { name: "Volume (mL)" }).fill("0");
  await second.getByRole("button", { name: "Show optional fields" }).click();
  await second
    .locator('input[type="datetime-local"]')
    .first()
    .fill("2026-09-28T09:00");
  await second
    .locator('input[type="datetime-local"]')
    .nth(1)
    .fill("2026-09-28T08:00");
  await chart
    .getByRole("row", { name: "New output entry", exact: true })
    .getByRole("spinbutton", { name: "Volume (mL)" })
    .fill("0");
  const third = chart.getByRole("row", { name: "Entry 3", exact: true });
  await third
    .getByRole("combobox", { name: "Source" })
    .selectOption("wound_drain");
  await third
    .getByRole("combobox", { name: "Volume availability" })
    .selectOption("not-performed");
  await chart
    .getByRole("row", { name: "New intake entry", exact: true })
    .getByRole("spinbutton", { name: "Volume (mL)" })
    .fill("0");
  const fourth = chart.getByRole("row", { name: "Entry 4", exact: true });
  await fourth.getByRole("spinbutton", { name: "Volume (mL)" }).fill("420");
  await expect(chart.locator(".io-summary strong")).toHaveText([
    "670mL",
    "0mL",
    "+670mL",
  ]);
  await chart.getByRole("button", { name: "Remove entry 4" }).click();
  await expect(chart.locator(".io-entry")).toHaveCount(3);
  await expect(
    chart
      .getByRole("table", { name: "Intake entries", exact: true })
      .locator(".io-entry"),
  ).toHaveCount(1);
  await expect(
    chart
      .getByRole("table", { name: "Output entries", exact: true })
      .locator(".io-entry"),
  ).toHaveCount(2);
  await expect(
    first
      .getByRole("combobox", { name: "Source" })
      .getByRole("option", { name: "Urine", exact: true }),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(
    second
      .getByRole("combobox", { name: "Source" })
      .getByRole("option", { name: "Oral · measured", exact: true }),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");

  await second.getByRole("spinbutton", { name: "Volume (mL)" }).fill("-1");
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();
  await expect(second.getByRole("alert").first()).toContainText("nonnegative");
  await second.getByRole("spinbutton", { name: "Volume (mL)" }).fill("0");
  await expect(chart.locator(".io-summary strong")).toHaveText([
    "250mL",
    "0mL",
    "+250mL",
  ]);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await chart.evaluate((el) => el.scrollWidth <= el.clientWidth),
  ).toBeTruthy();
  const entriesTable = chart.getByRole("region", {
    name: "Output entries",
  });
  expect(
    await entriesTable.evaluate((el) => el.scrollWidth > el.clientWidth),
  ).toBeTruthy();
  await entriesTable.evaluate((el) => {
    el.scrollLeft = el.scrollWidth;
  });
  await third
    .getByRole("textbox", { name: "Notes (optional)" })
    .scrollIntoViewIfNeeded();
  await expect(
    third.getByRole("textbox", { name: "Notes (optional)" }),
  ).toBeInViewport();
  await entriesTable.evaluate((el) => {
    el.scrollLeft = 0;
  });
  await page.screenshot({
    path: "output/playwright/io-balance-mobile.png",
    fullPage: true,
  });
  await second.getByRole("button", { name: "Hide optional fields" }).click();
  await page.setViewportSize({ width: 1400, height: 1100 });
  expect(
    await chart.evaluate((el) => el.getBoundingClientRect().height),
  ).toBeLessThan(500);
  await expect(
    chart.getByRole("columnheader", { name: "Collection start (optional)" }),
  ).toHaveCount(0);
  await chart.screenshot({
    path: "output/playwright/io-balance-fill.png",
  });
  const batch = page.waitForResponse(
    (response) =>
      response.url().includes("/api/v1/batch_requests/") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();
  const submitted = await batch;
  expect(submitted.ok(), await submitted.text()).toBeTruthy();
  const result = (await submitted.json()).results.find(
    (r: { data?: { id?: string } }) => r.data?.id,
  );
  expect(result?.status_code).toBe(200);
  const responseId = result.data.id;
  const observationsResponse = await request.get(
    `${api}/api/v1/patient/${patientId}/observation/?encounter=${encounterId}&limit=100`,
    { headers },
  );
  expect(observationsResponse.ok()).toBeTruthy();
  const observations = (await observationsResponse.json()).results;
  expect(observations).toHaveLength(3);
  const components = observations.flatMap(
    (o: { component: unknown[] }) => o.component,
  );
  expect(components).toHaveLength(2);
  const oral = components.find(
    (c: { code: { code: string } }) => c.code.code === "9000-1",
  );
  const urine = components.find(
    (c: { code: { code: string } }) => c.code.code === "9187-6",
  );
  expect(oral.value).toMatchObject({ value: "250", unit: { code: "mL" } });
  expect(oral.note).toContain("Water");
  expect(urine.value.value).toBe("0");
  expect(urine.note).toContain("Collection start");
  expect(
    observations.every((o: { value_type: string }) => o.value_type === "group"),
  ).toBeTruthy();
  await page.goto(
    `/facility/${facilityId}/patient/${patientId}/encounter/${encounterId}/questionnaire_response/${responseId}`,
  );
  await expect(chart.locator(".io-entry")).toHaveCount(3);
  await expect(chart.getByText("Not measured", { exact: true })).toBeVisible();
  await expect(chart.locator("input,select,textarea,button")).toHaveCount(0);
  await page.screenshot({
    path: "output/playwright/io-balance-readback.png",
    fullPage: true,
  });
  await page.goto(
    `/facility/${facilityId}/patient/${patientId}/encounter/${encounterId}/questionnaire_response/${responseId}/print`,
  );
  await expect(chart.locator(".io-entry")).toHaveCount(3);
  await page.emulateMedia({ media: "print" });
  await expect(chart).toBeVisible();
  await page.screenshot({
    path: "output/playwright/io-balance-print.png",
    fullPage: true,
  });
  await page.emulateMedia({ media: "screen" });
  await page.goto(
    `/facility/${facilityId}/patient/${patientId}/encounter/${encounterId}/questionnaire/${questionnaireKey}`,
  );
  const history = chart.getByRole("region", {
    name: "Recorded I/O in this encounter",
  });
  await expect(history).toHaveCount(0);
  await expect(
    chart.getByRole("button", { name: "Refresh recorded I/O" }),
  ).toHaveCount(0);
  await page.goto(
    `/facility/${facilityId}/patient/${patientId}/encounter/${encounterId}/updates`,
  );
  await page.getByRole("tab", { name: "I/O Balance", exact: true }).click();
  await expect(page).toHaveURL(/\/io_balance$/);
  await expect(history.locator(".io-history-entries tbody tr")).toHaveCount(2);
  await expect(history.locator(".io-summary strong")).toHaveText([
    "250mL",
    "0mL",
    "+250mL",
  ]);
  await expect(
    history.getByText("Saved volume observations for the selected encounter."),
  ).toBeVisible();
  await page.screenshot({
    path: "output/playwright/io-balance-tab.png",
    fullPage: true,
  });
  const offsets: number[] = [];
  let failLastPage = false;
  await page.route(
    `**/api/v1/patient/${patientId}/observation/**`,
    async (route) => {
      const params = new URL(route.request().url()).searchParams;
      expect(params.get("encounter")).toBe(encounterId);
      expect(params.get("ignore_group")).not.toBe("true");
      expect(params.has("codes")).toBeFalsy();
      const limit = Number(params.get("limit"));
      const offset = Number(params.get("offset"));
      offsets.push(offset);
      if (offset && failLastPage)
        return route.fulfill({ status: 500, json: { detail: "Test failure" } });
      await route.fulfill({
        json: {
          count: limit + observations.length,
          results: offset
            ? observations
            : Array.from({ length: limit }, () =>
                observations.find(
                  (o: { component: unknown[] }) => o.component.length,
                ),
              ),
        },
      });
    },
  );
  await expect(
    history.getByRole("button", { name: "Refresh recorded I/O" }),
  ).toHaveCount(0);
  await page.reload();
  await expect(history.locator(".io-history-entries tbody tr")).toHaveCount(2);
  const pages = [...new Set(offsets)];
  expect(pages).toHaveLength(2);
  expect(pages[0]).toBe(0);
  expect(pages[1]).toBeGreaterThan(0);
  failLastPage = true;
  await page.reload();
  await expect(history.getByRole("alert")).toContainText(
    "Could not load all recorded I/O",
  );
  await expect(history.locator(".io-summary")).toHaveCount(0);
  failLastPage = false;
  await history.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(history.locator(".io-summary strong")).toHaveText([
    "250mL",
    "0mL",
    "+250mL",
  ]);
  await page.unroute(`**/api/v1/patient/${patientId}/observation/**`);
  const other = await request.post(`${api}/api/v1/encounter/`, {
    headers,
    data: {
      patient: patientId,
      facility: facilityId,
      status: "completed",
      encounter_class: "amb",
      period: { start: "2026-09-27T08:00:00Z", end: "2026-09-27T09:00:00Z" },
      priority: "routine",
      organizations: [],
    },
  });
  expect(other.ok(), await other.text()).toBeTruthy();
  const otherId = (await other.json()).id;
  const selectedRequest = page.waitForRequest(
    (req) =>
      req.url().includes(`/patient/${patientId}/observation/`) &&
      new URL(req.url()).searchParams.get("encounter") === otherId,
  );
  await page.goto(
    `/facility/${facilityId}/patient/${patientId}/encounter/${encounterId}/io_balance?selectedEncounter=${otherId}`,
  );
  await selectedRequest;
  await expect(history.locator(".io-summary strong")).toHaveText([
    "0mL",
    "0mL",
    "0mL",
  ]);
  await expect(
    history.getByText("No recorded volume components found."),
  ).toBeVisible();
});

for (const mode of ["local", "remote"] as const) {
  test(`${mode} I/O plugin supports row switching, validation, clearing, locked and printed readback`, async ({
    page,
  }) => {
    test.skip(
      mode === "remote" && !process.env.CARE_IO_REMOTE_URL,
      "Requires built plugin preview",
    );
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/__io-preview", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="font-family:system-ui;margin:24px"><main id="root" style="max-width:1000px;margin:auto"></main><div class="hidden" id="host-style">Host CSS sentinel</div></body></html>',
      }),
    );
    await page.context().grantPermissions(["local-network-access"]);
    await page.addInitScript(() => {
      window.CARE_API_URL = window.location.origin;
    });
    await page.route(
      "**/api/v1/patient/io-test-patient/observation/**",
      (route) =>
        route.fulfill({
          json: {
            count: 1,
            results: [
              {
                id: "saved-panel",
                status: "final",
                effective_datetime: "2026-09-28T08:00:00Z",
                component: [
                  {
                    code: { system: "http://loinc.org", code: "9187-6" },
                    value: {
                      value: "125",
                      unit: { system: "http://unitsofmeasure.org", code: "mL" },
                    },
                  },
                ],
              },
            ],
          },
        }),
    );
    await page.goto("/__io-preview");
    await page.evaluate(
      async ({ mode, remoteUrl }) => {
        const load = (path: string) => import(path);
        const { default: refresh } = await load("/@react-refresh");
        refresh.injectIntoGlobalHook(window);
        Object.assign(window, {
          $RefreshReg$: () => {},
          $RefreshSig$: () => (type: unknown) => type,
          __vite_plugin_react_preamble_installed__: true,
        });
        const host = await load(
          `/apps/care_io_balance_fe/tests/browser.tsx?run=${Date.now()}`,
        );
        let manifest;
        if (mode === "remote") {
          const remote = await load(remoteUrl!);
          remote.init({
            react: {
              [host.React.version]: {
                get: () => () => host.React,
                loaded: true,
              },
            },
            "react-dom": {
              [host.ReactDOM.version]: {
                get: () => () => host.ReactDOM,
                loaded: true,
              },
            },
            "react-i18next": {
              "17.0.8": { get: () => () => host.reactI18next, loaded: true },
            },
          });
          const loaded = (await remote.get("./manifest"))();
          manifest = loaded.default ?? loaded;
        } else
          manifest = (await load("/apps/care_io_balance_fe/src/manifest.tsx"))
            .default;
        await host.mountIO(
          manifest.registeredQuestionGroups[0],
          manifest.plugin,
          manifest.encounterTabs.io_balance,
        );
      },
      { mode, remoteUrl: process.env.CARE_IO_REMOTE_URL },
    );
    const chart = page.locator(".care-io-balance-fe");
    const untouched = JSON.parse(
      (await page.locator("#submitted").textContent()) ?? "[]",
    );
    expect(
      untouched.flatMap(
        (result: { sub_results?: unknown[] }) => result.sub_results ?? [],
      ),
    ).toHaveLength(0);
    await expect(chart.locator(".io-new-entry")).toHaveCount(2);
    await chart
      .getByRole("row", { name: "New intake entry", exact: true })
      .getByRole("spinbutton", { name: "Volume (mL)" })
      .focus();
    await page.keyboard.type("250");
    const first = chart.getByRole("row", { name: "Entry 1", exact: true });
    await expect(
      first.getByRole("spinbutton", { name: "Volume (mL)" }),
    ).toBeFocused();
    await expect(
      first.getByRole("spinbutton", { name: "Volume (mL)" }),
    ).toHaveValue("250");
    await expect(chart.locator(".io-new-entry")).toHaveCount(2);
    await first
      .getByRole("combobox", { name: "Source" })
      .selectOption("iv_measured");
    await expect(
      first.getByRole("spinbutton", { name: "Volume (mL)" }),
    ).toHaveValue("250");
    await expect(
      first.getByRole("textbox", { name: "Notes (optional)" }),
    ).toBeHidden();
    await first.getByRole("button", { name: "Show optional fields" }).focus();
    await page.keyboard.press("Enter");
    await first
      .getByRole("textbox", { name: "Notes (optional)" })
      .fill("Preserved note");
    await first.getByRole("button", { name: "Hide optional fields" }).click();
    await expect(
      first.getByRole("textbox", { name: "Notes (optional)" }),
    ).toBeHidden();
    await first.getByRole("button", { name: "Show optional fields" }).click();
    await expect(
      first.getByRole("textbox", { name: "Notes (optional)" }),
    ).toHaveValue("Preserved note");
    await first.getByRole("textbox", { name: "Notes (optional)" }).clear();
    await first.getByRole("button", { name: "Hide optional fields" }).click();
    await chart
      .getByRole("row", { name: "New output entry", exact: true })
      .getByRole("spinbutton", { name: "Volume (mL)" })
      .focus();
    await page.keyboard.type("0");
    const second = chart.getByRole("row", { name: "Entry 2", exact: true });
    const hostStyles = await page.addStyleTag({
      url: "/src/style/index.css?direct",
    });
    await page.screenshot({
      path: `output/playwright/io-redesign-form-${mode}.png`,
      fullPage: true,
    });
    await hostStyles.evaluate((el) => el.remove());
    await second.getByRole("spinbutton", { name: "Volume (mL)" }).fill("-10");
    await page.getByRole("button", { name: "Save test response" }).click();
    expect(errors).toEqual([]);
    await expect(second.getByRole("alert").first()).toContainText(
      "nonnegative",
    );
    await second.getByRole("spinbutton", { name: "Volume (mL)" }).fill("150");
    await second.getByRole("spinbutton", { name: "Volume (mL)" }).clear();
    await expect(chart.locator(".io-summary strong")).toHaveText([
      "250mL",
      "0mL",
      "+250mL",
    ]);
    await second.getByRole("spinbutton", { name: "Volume (mL)" }).fill("150");
    await chart
      .getByRole("row", { name: "New output entry", exact: true })
      .getByRole("spinbutton", { name: "Volume (mL)" })
      .fill("0");
    await chart.getByRole("button", { name: "Remove entry 3" }).click();
    await expect(chart.locator(".io-entry")).toHaveCount(2);
    await page.getByRole("checkbox", { name: "Lock chart" }).check();
    await expect(chart.getByRole("button")).toHaveCount(0);
    await expect(chart.locator("input,select,textarea")).toHaveCount(0);
    await page.getByRole("checkbox", { name: "Lock chart" }).uncheck();
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await chart.evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBeTruthy();
    await page.getByRole("button", { name: "Save test response" }).click();
    await expect(chart.locator("input,select,textarea,button")).toHaveCount(0);
    await expect(chart.locator(".io-summary strong")).toHaveText([
      "250mL",
      "150mL",
      "+100mL",
    ]);
    const submitted = JSON.parse(
      (await page.locator("#submitted").textContent()) ?? "[]",
    );
    expect(submitted[0].sub_results).toHaveLength(2);
    expect(submitted[0].sub_results[0]).toHaveLength(4); // kind, availability, time, selected volume
    const schema: { id: string; link_id: string; code?: { code: string } }[] =
      JSON.parse(
        (await page.locator("#submitted").getAttribute("data-questions")) ??
          "[]",
      );

    expect(submitted[0].sub_results[0]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          question_id: schema.find((q) => q.link_id === "io__kind")!.id,
          values: [expect.objectContaining({ value: "iv_measured" })],
        }),
        expect.objectContaining({
          question_id: schema.find((q) => q.code?.code === "8975-5")!.id,
          values: [expect.objectContaining({ value: "250" })],
        }),
      ]),
    );
    expect(
      submitted[0].sub_results[0].some(
        (answer: { question_id: string }) =>
          answer.question_id ===
          schema.find((q) => q.code?.code === "9000-1")!.id,
      ),
    ).toBeFalsy();
    expect(submitted[0].sub_results[1]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          question_id: schema.find((q) => q.code?.code === "9187-6")!.id,
          values: [expect.objectContaining({ value: "150" })],
        }),
      ]),
    );
    expect(
      submitted[0].sub_results[0].some(
        (answer: { values?: { value?: string }[] }) =>
          answer.values?.[0]?.value?.includes("T"),
      ),
    ).toBeTruthy();
    await expect(page.locator("#host-style")).toBeVisible(); // remote CSS must not add a global reset
    await page.setViewportSize({ width: 1100, height: 1000 });
    await page.emulateMedia({ media: "print" });
    await page.screenshot({
      path: `output/playwright/io-balance-${mode}.png`,
      fullPage: true,
    });
    await page.emulateMedia({ media: "screen" });
    await page.getByRole("button", { name: "Open I/O tab" }).click();
    const tab = page.getByRole("region", {
      name: "Recorded I/O in this encounter",
    });
    await expect(tab.locator(".io-history-entries tbody tr")).toHaveCount(1);
    await expect(tab.locator(".io-summary strong")).toHaveText([
      "0mL",
      "125mL",
      "-125mL",
    ]);
    await expect(
      tab.getByRole("heading", { name: "Hourly intake and output" }),
    ).toBeVisible();
    await tab.getByRole("button", { name: "Intake", exact: true }).click();
    await expect(tab.getByText("No entries match this filter.")).toBeVisible();
    await tab.getByRole("button", { name: "Output", exact: true }).click();
    await expect(tab.locator(".io-history-entries tbody tr")).toHaveCount(1);
    await tab.getByLabel("Chart date").fill("2026-09-01");
    await expect(
      tab.getByText("No recorded volume components found for this chart date."),
    ).toBeVisible();
    await expect(tab.locator(".io-summary strong")).toHaveText([
      "0mL",
      "0mL",
      "0mL",
    ]);
    await tab.getByLabel("Chart date").fill("2026-09-28");
    await tab.getByRole("button", { name: "All", exact: true }).click();
    await page.screenshot({
      path: `output/playwright/io-redesign-page-${mode}.png`,
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await tab.evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBeTruthy();
    await page.screenshot({
      path: `output/playwright/io-redesign-page-mobile-${mode}.png`,
      fullPage: true,
    });
    expect(errors).toEqual([]);
  });
}
