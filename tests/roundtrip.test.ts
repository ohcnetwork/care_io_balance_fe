import assert from "node:assert/strict";
import test from "node:test";
import { serializeQuestionResults } from "../../../src/components/QuestionnaireV2/fill/submit/serializeQuestionResults";
import { initializeResponses } from "../../../src/components/QuestionnaireV2/form/engine/store";
import { updateGroupRows } from "../../../src/components/QuestionnaireV2/groups/bindings";
import type { RegisteredGroupDefinition } from "../../../src/components/QuestionnaireV2/groups/registry";
import { storedGroupFields } from "../../../src/components/QuestionnaireV2/groups/storedGroupFields";
import type { Question } from "../../../src/types/questionnaire/question";
const children: Question[] = [
  {
    id: "volume",
    link_id: "io__volume",
    text: "Volume",
    type: "decimal",
    code: {
      system: "http://loinc.org",
      code: "9187-6",
      display: "Urine output",
    },
  },
  { id: "when", link_id: "io__when", text: "When", type: "dateTime" },
  {
    id: "availability",
    link_id: "io__availability",
    text: "Availability",
    type: "choice",
  },
];
const group: Question = {
  id: "io",
  link_id: "io",
  text: "I/O",
  type: "group",
  repeats: true,
  is_component: true,
  questions: children,
};
const definition: RegisteredGroupDefinition = {
  type: "io.chart",
  label: "I/O",
  subjects: ["encounter"],
  repeats: true,
  schema: children.map((q) => ({ ...q, link_id: q.id })),
  builder: () => null,
  component: () => null,
};
test("ordinary I/O answers roundtrip zero, collection time and unavailable rows", () => {
  let responses = initializeResponses([group]);
  responses = updateGroupRows(group, definition, [group], responses, {
    type: "add",
    updates: {
      volume: { values: [{ type: "number", value: 0 }] },
      when: {
        values: [{ type: "dateTime", value: new Date("2026-09-28T08:00:00Z") }],
      },
      availability: { values: [{ type: "string", value: "known" }] },
    },
  });
  responses = updateGroupRows(group, definition, [group], responses, {
    type: "add",
    updates: {
      availability: { values: [{ type: "string", value: "unknown" }] },
    },
  });
  const submitted = serializeQuestionResults([group], responses);
  assert.equal(submitted[0].sub_results?.length, 2);
  assert.equal(submitted[0].sub_results![0][0].values![0].value, "0");
  const restored = storedGroupFields(
    Object.fromEntries(children.map((q) => [q.id, q])),
    submitted[0].sub_results![0],
  );
  assert.equal(
    (restored.when!.response.values[0].value as Date).toISOString(),
    "2026-09-28T08:00:00.000Z",
  );
  assert.equal(submitted[0].sub_results![1].length, 1);
  assert.equal(submitted[0].sub_results![1][0].values![0].value, "unknown");
});
