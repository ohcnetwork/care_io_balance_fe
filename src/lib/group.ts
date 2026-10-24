import en from "../../public/locale/en.json";
import type {
  GroupQuestionDefinition,
  GroupRow,
  QuestionnaireResponse,
} from "../types/host";

export const KINDS = [
  {
    key: "oral_measured",
    direction: "input",
    code: "9000-1",
    display: "Fluid intake oral Measured",
  },
  {
    key: "oral_estimated",
    direction: "input",
    code: "8999-5",
    display: "Fluid intake oral Estimated",
  },
  {
    key: "enteral_measured",
    direction: "input",
    code: "8953-2",
    display: "Fluid intake enteral tube Measured",
  },
  {
    key: "enteral_estimated",
    direction: "input",
    code: "8952-4",
    display: "Fluid intake enteral tube Estimated",
  },
  {
    key: "iv_measured",
    direction: "input",
    code: "8975-5",
    display: "Fluid intake intravascular Measured",
  },
  {
    key: "iv_estimated",
    direction: "input",
    code: "8974-8",
    display: "Fluid intake intravascular Estimated",
  },
  {
    key: "urine",
    direction: "output",
    code: "9187-6",
    display: "Urine output",
  },
  {
    key: "wound_drain",
    direction: "output",
    code: "9203-1",
    display: "Fluid output wound drain",
  },
  {
    key: "blood_loss",
    direction: "output",
    code: "81661-1",
    display: "Blood loss [Volume] Measured",
  },
] as const;
export const UNIT = {
  system: "http://unitsofmeasure.org",
  code: "mL",
  display: "mL",
};
export const IO_SCHEMA: readonly GroupQuestionDefinition[] = [
  {
    link_id: "kind",
    type: "choice",
    text: en.kind,
    required: true,
    answer_option: KINDS.map(({ key }) => ({ value: key })),
  },
  { link_id: "source", type: "string", text: en.source },
  { link_id: "comment", type: "text", text: en.comment },
  {
    link_id: "availability",
    type: "choice",
    text: en.availability,
    required: true,
    answer_option: ["known", "unknown", "not-performed", "error"].map(
      (value) => ({ value }),
    ),
  },
  { link_id: "measured_at", type: "dateTime", text: en.when, required: true },
  { link_id: "period_start", type: "dateTime", text: en.start },
  ...KINDS.map(({ key, code, display }): GroupQuestionDefinition => ({
    link_id: key,
    type: "decimal",
    text: en[key],
    unit: UNIT,
    code: { system: "http://loinc.org", code, display },
  })),
];
export function selected(row: GroupRow) {
  return KINDS.find(
    (kind) => kind.key === row.fields.kind?.response.values[0]?.value,
  );
}
export function validVolume(
  response?: QuestionnaireResponse,
): number | undefined {
  if (!response) return;
  const value = response.values[0]?.value;
  if (value === undefined || value === null || value === "") return;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : undefined;
}
export function totals(rows: GroupRow[]) {
  let input = 0,
    output = 0,
    incomplete = 0;
  for (const row of rows) {
    const kind = selected(row);
    const value =
      kind && row.fields.availability?.response.values[0]?.value === "known"
        ? validVolume(row.fields[kind.key]?.response)
        : undefined;
    if (value === undefined || !kind) {
      incomplete++;
      continue;
    }
    if (kind.direction === "input") input += value;
    else output += value;
  }
  return { input, output, balance: input - output, incomplete };
}
export function localDateTime(iso?: string | Date) {
  if (!iso) return "";
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
