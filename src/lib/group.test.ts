import assert from "node:assert/strict";
import test from "node:test";
import type { GroupRow, Question } from "../types/host";
import { IO_SCHEMA, KINDS, totals } from "./group";
import {
  dailyReport,
  reportingDay,
  summarizeObservations,
  type PanelObservation,
} from "./observations";
import { validateIO } from "./validate";
const group: Question = {
  id: "io",
  link_id: "io",
  text: "I/O",
  type: "group",
  repeats: true,
  is_component: true,
  questions: IO_SCHEMA.map(
    (q) =>
      ({
        ...q,
        id: q.link_id,
        link_id: `io__${q.link_id}`,
      }) as Question,
  ),
};
function row(
  kind: string,
  volume: unknown,
  availability = "known",
  start?: string,
) {
  const data: Record<string, unknown> = {
    kind,
    [kind]: volume,
    availability,
    measured_at: "2026-09-28T08:00:00Z",
    period_start: start,
  };
  return {
    onChange: () => {},
    remove: () => {},
    fields: Object.fromEntries(
      group.questions!.map((question) => [
        question.id,
        {
          question,
          disabled: false,
          hidden: false,
          errors: [],
          response: {
            question_id: question.id,
            link_id: question.link_id,
            structured_type: null,
            values:
              data[question.id] == null
                ? []
                : [{ type: question.type, value: data[question.id] }],
          },
        },
      ]),
    ),
  } as GroupRow;
}
function validate(rows: GroupRow[], question = group) {
  return validateIO(
    question,
    {
      io: {
        question_id: "io",
        link_id: "io",
        structured_type: null,
        values: [],
        sub_results: rows.map((row) =>
          Object.values(row.fields).flatMap((f) => (f ? [f.response] : [])),
        ),
      },
    },
    [],
  );
}
test("panel schema uses fixed coded volumes without repeated-row backend conditions", () => {
  for (const kind of KINDS) {
    const field = IO_SCHEMA.find((q) => q.link_id === kind.key)!;
    assert.equal(field.code?.code, kind.code);
    assert.equal(field.unit?.code, "mL");
    assert.equal(field.enable_when, undefined);
    assert.ok(!field.required);
  }
  assert.ok(validate([], { ...group, is_component: false }).length);
});
test("rows preserve zero, unavailable volumes and collection times", () => {
  const rows = [
    row("oral_measured", 250),
    row("iv_measured", 100.5),
    row("urine", 150),
    row("urine", 0),
    row("wound_drain", undefined, "unknown"),
  ];
  assert.deepEqual(totals(rows), {
    input: 350.5,
    output: 150,
    balance: 200.5,
    incomplete: 1,
  });
  assert.deepEqual(validate(rows), []);
  for (const invalid of [
    row("urine", -1),
    row("urine", "NaN"),
    row("urine", undefined),
    row("urine", 0, "unknown"),
    row("urine", 20, "known", "2026-09-28T09:00:00Z"),
  ])
    assert.ok(validate([invalid]).length);
  const extra = row("urine", 20);
  extra.fields.oral_measured!.response.values = [{ type: "number", value: 15 }];
  assert.ok(validate([extra]).length);
  const missing = row("urine", 20);
  missing.fields.urine = null;
  assert.equal(totals([missing]).incomplete, 1);
  assert.ok(
    validate([missing], {
      ...group,
      questions: group.questions!.filter((q) => q.id !== "urine"),
    }).length,
  );
});
test("Observation computation deduplicates IDs, normalizes units and excludes invalid records", () => {
  const panel = (
    id: string,
    code: string,
    value: string,
    unit = "mL",
    status = "final",
  ): PanelObservation => ({
    id,
    status,
    effective_datetime: "2026-09-28T08:00:00Z",
    component: [
      {
        code: { system: "http://loinc.org", code },
        value: {
          value,
          unit: { system: "http://unitsofmeasure.org", code: unit },
        },
      },
    ],
  });
  const input = panel("input", "9000-1", "0.5", "L");
  const result = summarizeObservations([
    input,
    input,
    panel("out", "9187-6", "200"),
    panel("zero", "9187-6", "0"),
    panel("bad-unit", "9187-6", "5", "kg"),
    panel("bad-value", "9187-6", "NaN"),
    panel("invalidated", "9000-1", "999", "mL", "entered_in_error"),
  ]);
  assert.equal(result.input, 500);
  assert.equal(result.output, 200);
  assert.equal(result.balance, 300);
  assert.equal(result.entries.length, 3);
  assert.equal(result.skipped, 2);
});

test("daily charts respect 08:00 boundaries, shift totals, zero and invalid times", () => {
  const entries = [
    {
      id: "previous",
      kind: KINDS[0],
      volume: 90,
      recordedAt: "2026-10-05T07:59:59",
      note: "",
    },
    {
      id: "morning",
      kind: KINDS[0],
      volume: 250,
      recordedAt: "2026-10-05T08:00:00",
      note: "",
    },
    {
      id: "evening",
      kind: KINDS.find((k) => k.key === "urine")!,
      volume: 100,
      recordedAt: "2026-10-05T14:00:00",
      note: "",
    },
    {
      id: "midnight",
      kind: KINDS.find((k) => k.key === "urine")!,
      volume: 0,
      recordedAt: "2026-10-06T00:00:00",
      note: "",
    },
    {
      id: "next",
      kind: KINDS[0],
      volume: 700,
      recordedAt: "2026-10-06T08:00:00",
      note: "",
    },
    {
      id: "invalid",
      kind: KINDS[0],
      volume: 30,
      recordedAt: "invalid",
      note: "",
    },
  ];
  assert.equal(reportingDay(entries[0].recordedAt), "2026-10-04");
  assert.equal(reportingDay(entries[3].recordedAt), "2026-10-05");
  assert.equal(reportingDay("invalid"), "");
  const report = dailyReport(entries, "2026-10-05");
  assert.deepEqual(
    [report.input, report.output, report.balance, report.urine],
    [250, 100, 150, 100],
  );
  assert.deepEqual(
    report.entries.map((e) => e.id),
    ["midnight", "evening", "morning"],
  );
  assert.deepEqual(
    report.shifts.map((s) => [s.input, s.output, s.count]),
    [
      [250, 0, 1],
      [0, 100, 1],
      [0, 0, 1],
    ],
  );
  assert.equal(
    report.hours.reduce((total, h) => total + h.input - h.output, 0),
    150,
  );
  assert.equal(report.sources.find((s) => s.kind.key === "urine")?.count, 2);
  const empty = dailyReport(entries, "2026-10-01");
  assert.equal(empty.entries.length, 0);
  assert.ok(empty.shifts.every((s) => s.count === 0));
});
