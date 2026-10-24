import { Fragment, useId } from "react";
import { useTranslation } from "../hooks/useTranslation";
import { KINDS, localDateTime, selected } from "../lib/group";
import type { GroupRow, QuestionnaireResponse } from "../types/host";
import { Button, Input, Select, Textarea } from "./controls";

export default function IOEntry({
  row,
  number,
  disabled,
  expanded,
  onToggleAdvanced,
  placeholder,
}: {
  row: GroupRow;
  placeholder?: string;
  number: number;
  disabled: boolean;
  expanded: boolean;
  onToggleAdvanced: () => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const kind = selected(row);
  const field = kind ? row.fields[kind.key] : null;
  const value = (key: string) => row.fields[key]?.response.values[0]?.value;
  const available = value("availability") ?? "known";
  const visible = (key: string) => row.fields[key] && !row.fields[key]?.hidden;
  const locked = (key: string) =>
    disabled || !row.fields[key] || !!row.fields[key]?.disabled;
  const rowLocked = Object.values(row.fields).some(
    (f) => f && (f.question.read_only || (!f.hidden && f.disabled)),
  );
  const patch = (updates: Record<string, Partial<QuestionnaireResponse>>) => {
    if (disabled) return;
    const nextKind = String(
      updates.kind?.values?.[0]?.value ?? kind?.key ?? "",
    );
    const next = (key: string) =>
      key in updates ? updates[key].values?.[0]?.value : value(key);
    const timestamp = (v: unknown) => {
      const date = new Date(v as string | Date);
      return v && Number.isFinite(date.getTime()) ? date.toISOString() : "";
    };
    const note = [
      next("source") ? t("source_note", { source: next("source") }) : "",
      next("measured_at")
        ? `${t("when")}: ${timestamp(next("measured_at"))}`
        : "",
      next("period_start")
        ? `${t("start")}: ${timestamp(next("period_start"))}`
        : "",
      next("comment") ? String(next("comment")) : "",
    ]
      .filter(Boolean)
      .join("\n");
    if (nextKind && !locked(nextKind))
      updates[nextKind] = { ...updates[nextKind], note };
    row.onChange(updates);
  };
  const textPatch = (key: string, text: string) =>
    patch({ [key]: { values: text ? [{ type: "string", value: text }] : [] } });
  const errors = Object.values(row.fields).flatMap((f) =>
    f && !f.hidden ? f.errors : [],
  );
  return (
    <tr
      className={placeholder ? "io-new-entry" : "io-entry"}
      aria-label={placeholder ?? t("entry", { number })}
    >
      <td>
        {visible("kind") && (
          <label htmlFor={`${id}-kind`}>
            <span className="io-sr-only">{t("kind")}</span>
            {disabled ? (
              <strong>{kind ? t(kind.key) : t("missing")}</strong>
            ) : (
              <Select
                id={`${id}-kind`}
                value={kind?.key ?? ""}
                disabled={locked("kind") || rowLocked}
                onValueChange={(next) => {
                  if (!row.fields[next] || !KINDS.some((k) => k.key === next))
                    return;
                  patch({
                    kind: { values: [{ type: "string", value: next }] },
                    ...(kind ? { [kind.key]: { values: [], note: "" } } : {}),
                    [next]: { values: field?.response.values ?? [] },
                  });
                }}
                options={(row.fields.kind?.question.answer_option ?? [])
                  .filter((option) =>
                    KINDS.some(
                      (candidate) =>
                        candidate.key === option.value &&
                        candidate.direction === (kind?.direction ?? "input"),
                    ),
                  )
                  .map((option) => ({
                    value: option.value,
                    label: t(option.value),
                  }))}
              />
            )}
          </label>
        )}
        {!field && <p role="alert">{t("schema_error")}</p>}
        {errors.map((error, index) => (
          <p role="alert" key={index}>
            {error.msg ?? error.error}
          </p>
        ))}
      </td>
      <td className="io-details-cell">
        {visible("source") && (!disabled || !!value("source")) && (
          <label htmlFor={`${id}-source`}>
            <span className="io-sr-only">{t("source")}</span>
            {disabled ? (
              <span>{String(value("source") ?? "")}</span>
            ) : (
              <Input
                id={`${id}-source`}
                placeholder={t("details_placeholder")}
                value={String(value("source") ?? "")}
                disabled={locked("source") || (kind ? locked(kind.key) : true)}
                onChange={(e) => textPatch("source", e.target.value)}
              />
            )}
          </label>
        )}
      </td>
      <td className="io-volume-cell">
        {field && !field.hidden && (
          <label htmlFor={`${id}-volume`}>
            <span className="io-sr-only">{t("volume")}</span>
            {disabled ? (
              <strong>
                {available === "known"
                  ? String(field.response.values[0]?.value ?? t("missing"))
                  : t("missing")}
              </strong>
            ) : (
              <Input
                id={`${id}-volume`}
                type="number"
                placeholder="0"
                inputMode="decimal"
                min="0"
                step="any"
                disabled={locked(kind!.key) || available !== "known"}
                value={String(field.response.values[0]?.value ?? "")}
                aria-invalid={field.errors.length > 0}
                onChange={(e) =>
                  patch({
                    [kind!.key]: {
                      values:
                        e.target.value === ""
                          ? []
                          : [{ type: "number", value: e.target.value }],
                    },
                  })
                }
              />
            )}
          </label>
        )}
      </td>
      {!disabled && (
        <td className="io-expand-cell">
          <Button
            type="button"
            aria-expanded={expanded}
            aria-label={t(expanded ? "hide_optional" : "show_optional")}
            title={t(expanded ? "hide_optional" : "show_optional")}
            onClick={onToggleAdvanced}
          >
            <span aria-hidden="true">{expanded ? "›‹" : "‹›"}</span>
          </Button>
        </td>
      )}
      <td className="io-optional">
        {visible("availability") && (
          <label htmlFor={`${id}-availability`}>
            <span className="io-sr-only">{t("availability")}</span>
            {disabled ? (
              <span>{t(String(available))}</span>
            ) : (
              <Select
                id={`${id}-availability`}
                value={String(available)}
                disabled={locked("availability") || !kind || locked(kind.key)}
                onValueChange={(next) =>
                  patch({
                    availability: {
                      values: [{ type: "string", value: next }],
                    },
                    ...(kind ? { [kind.key]: { values: [] } } : {}),
                  })
                }
                options={(
                  row.fields.availability?.question.answer_option ?? []
                ).map((option) => ({
                  value: option.value,
                  label: t(option.value),
                }))}
              />
            )}
          </label>
        )}
      </td>
      {(["measured_at", "period_start"] as const).map((key) => (
        <Fragment key={key}>
          <td className="io-optional">
            {visible(key) && (!disabled || !!value(key)) && (
              <label key={key} htmlFor={`${id}-${key}`}>
                <span className="io-sr-only">
                  {t(key === "measured_at" ? "when" : "start")}
                </span>
                {disabled ? (
                  <span>
                    {value(key)
                      ? new Date(value(key) as string | Date).toLocaleString()
                      : t("missing")}
                  </span>
                ) : (
                  <Input
                    id={`${id}-${key}`}
                    type="datetime-local"
                    disabled={locked(key) || (kind ? locked(kind.key) : true)}
                    value={localDateTime(value(key) as Date | undefined)}
                    onChange={(e) =>
                      patch({
                        [key]: {
                          values: e.target.value
                            ? [
                                {
                                  type: "dateTime",
                                  value: new Date(e.target.value),
                                },
                              ]
                            : [],
                        },
                      })
                    }
                  />
                )}
              </label>
            )}
          </td>
        </Fragment>
      ))}
      <td className="io-optional">
        {visible("comment") && (
          <label htmlFor={`${id}-comment`}>
            <span className="io-sr-only">{t("comment")}</span>
            {disabled ? (
              <span>{String(value("comment") ?? "")}</span>
            ) : (
              <Textarea
                id={`${id}-comment`}
                rows={1}
                value={String(value("comment") ?? "")}
                disabled={locked("comment") || (kind ? locked(kind.key) : true)}
                onChange={(e) => textPatch("comment", e.target.value)}
              />
            )}
          </label>
        )}
      </td>
      {!disabled && (
        <td>
          {!placeholder && (
            <Button
              type="button"
              className="io-remove"
              disabled={rowLocked}
              aria-label={t("remove", { number })}
              onClick={row.remove}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 10v6M14 10v6" />
              </svg>
            </Button>
          )}
        </td>
      )}
    </tr>
  );
}
