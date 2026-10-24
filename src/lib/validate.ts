import i18next from "i18next";
import en from "../../public/locale/en.json";
import type {
  QuestionValidationError,
  RegisteredGroupDefinition,
} from "../types/host";
import { IO_SCHEMA, KINDS, UNIT } from "./group";

export const validateIO: NonNullable<RegisteredGroupDefinition["validate"]> = (
  question,
  responses,
  path,
) => {
  const errors: QuestionValidationError[] = [];
  const message = (key: keyof typeof en) =>
    i18next.t(key, { ns: "care_io_balance_fe", defaultValue: en[key] }) ||
    en[key];
  const fields = Object.fromEntries(
    (question.questions ?? []).map((q) => [
      q.link_id.slice(question.link_id.length + 2),
      q,
    ]),
  );
  const failGroup = (key: keyof typeof en) => [
    { question_id: question.id, response_path: path, error: message(key) },
  ];
  if (!question.repeats || !question.is_component)
    return failGroup("configuration_error");
  if (
    IO_SCHEMA.some((q) => !fields[q.link_id]) ||
    KINDS.some((kind) => {
      const field = fields[kind.key];
      return (
        field.code?.code !== kind.code ||
        field.code?.system !== "http://loinc.org" ||
        field.unit?.code !== UNIT.code ||
        field.unit?.system !== UNIT.system ||
        field.required ||
        field.enable_when?.length
      );
    })
  )
    return failGroup("schema_error");
  for (const [rowIndex, row] of (
    responses[question.id]?.sub_results ?? []
  ).entries()) {
    const values = Object.fromEntries(
      row.map((answer) => [answer.question_id, answer]),
    );
    const value = (key: string) => values[fields[key]?.id]?.values[0]?.value;
    const fail = (key: string, error: keyof typeof en) =>
      errors.push({
        question_id: fields[key]?.id ?? question.id,
        response_path: [...path, { questionId: question.id, rowIndex }],
        error: message(error),
      });
    const kind = KINDS.find((kind) => kind.key === value("kind"));
    if (!kind) {
      fail("kind", "kind_error");
      continue;
    }
    const availability = value("availability");
    const volume = value(kind.key);
    if (
      !["known", "unknown", "not-performed", "error"].includes(
        String(availability),
      ) ||
      (availability === "known"
        ? volume == null ||
          volume === "" ||
          !Number.isFinite(Number(volume)) ||
          Number(volume) < 0
        : volume != null && volume !== "") ||
      KINDS.some(
        (k) => k.key !== kind.key && values[fields[k.key].id]?.values.length,
      )
    )
      fail(kind.key, "volume_error");
    const end = new Date(value("measured_at") as string | Date).getTime();
    const start = value("period_start");
    if (
      !Number.isFinite(end) ||
      (start != null &&
        (!Number.isFinite(new Date(start as string | Date).getTime()) ||
          new Date(start as string | Date).getTime() > end))
    )
      fail("measured_at", "time_error");
  }
  return errors;
};
