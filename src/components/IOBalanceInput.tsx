import { useState } from "react";
import { useTranslation } from "../hooks/useTranslation";
import { selected, totals } from "../lib/group";
import "../style/index.css";
import type { GroupInputProps, QuestionnaireResponse } from "../types/host";
import { Button } from "./controls";
import IOEntry from "./IOEntry";

export default function IOBalanceInput({
  rows,
  fields,
  addRow,
  disabled,
}: GroupInputProps) {
  const { t } = useTranslation();
  const summary = totals(rows);
  const [expandedTables, setExpandedTables] = useState({
    input: false,
    output: false,
  });
  const format = (value: number) =>
    new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 }).format(
      value,
    );
  return (
    <div className="care-io-balance-fe io-form">
      {!!summary.incomplete && (
        <p role="status" className="io-incomplete">
          {t("incomplete", { count: summary.incomplete })}
        </p>
      )}
      {(["input", "output"] as const).map((direction) => {
        const entries = rows
          .map((row, index) => ({ row, index }))
          .filter(
            ({ row }) => (selected(row)?.direction ?? "input") === direction,
          );
        const expanded = disabled || expandedTables[direction];
        const toggle = () =>
          setExpandedTables((previous) => ({
            ...previous,
            [direction]: !previous[direction],
          }));
        const defaultKind = direction === "input" ? "oral_measured" : "urine";
        const initial: Record<string, Partial<QuestionnaireResponse>> = {
          kind: { values: [{ type: "string", value: defaultKind }] },
          availability: { values: [{ type: "string", value: "known" }] },
          measured_at: { values: [{ type: "dateTime", value: new Date() }] },
        };
        return (
          <section
            className="io-entry-section"
            key={direction}
            aria-label={t(direction)}
          >
            <div className="io-section-heading">
              <h4>
                <span
                  className={`io-marker io-${direction}`}
                  aria-hidden="true"
                />
                {t(direction)}
              </h4>
              <span className="io-section-total">
                {format(summary[direction])} {t("unit")}
              </span>
            </div>
            <div
              className="io-table-scroll io-entry-container"
              role="region"
              aria-label={t(`${direction}_entries`)}
              tabIndex={0}
            >
              <table
                className={`io-entry-table ${expanded ? "io-expanded" : "io-collapsed"}${disabled ? " io-readonly" : ""}`}
              >
                <caption className="io-sr-only">
                  {t(`${direction}_entries`)}
                </caption>
                <thead>
                  <tr>
                    {["kind", "details", "volume"].map((key) => (
                      <th scope="col" key={key}>
                        {t(key)}
                      </th>
                    ))}
                    {!disabled && (
                      <th scope="col" className="io-expand-cell">
                        <Button
                          type="button"
                          aria-expanded={expanded}
                          aria-label={t(
                            expanded ? "hide_optional" : "show_optional",
                          )}
                          title={t(
                            expanded ? "hide_optional" : "show_optional",
                          )}
                          onClick={toggle}
                        >
                          <span aria-hidden="true">
                            {expanded ? "›‹" : "‹›"}
                          </span>
                        </Button>
                      </th>
                    )}
                    {["availability", "when", "start", "comment"].map((key) => (
                      <th scope="col" key={key} className="io-optional">
                        {t(key)}
                      </th>
                    ))}
                    {!disabled && (
                      <th scope="col">
                        <span className="io-sr-only">{t("actions")}</span>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {[
                    ...entries.map(({ row, index }) => (
                      <IOEntry
                        key={index}
                        row={row}
                        number={index + 1}
                        disabled={disabled}
                        expanded={expanded}
                        onToggleAdvanced={toggle}
                      />
                    )),
                    !disabled && (
                      <IOEntry
                        key={rows.length}
                        row={{
                          fields: Object.fromEntries(
                            Object.entries(fields).map(([key, field]) => [
                              key,
                              field && {
                                ...field,
                                response: {
                                  ...field.response,
                                  values: initial[key]?.values ?? [],
                                },
                              },
                            ]),
                          ),
                          onChange: (updates) => {
                            if (
                              !Object.values(updates).some(
                                (update) => update.values?.length,
                              )
                            )
                              return;
                            addRow({ ...initial, ...updates });
                          },
                          remove: () => {},
                        }}
                        number={rows.length + 1}
                        disabled={disabled}
                        placeholder={t(`new_${direction}`)}
                        expanded={expanded}
                        onToggleAdvanced={toggle}
                      />
                    ),
                  ]}
                  {disabled && !entries.length && (
                    <tr>
                      <td colSpan={7} className="io-empty">
                        {t(`empty_${direction}`)}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
      <div
        className="io-summary io-form-summary"
        aria-label={t("totals_scope")}
      >
        {(["input", "output", "balance"] as const).map((key) => (
          <div key={key}>
            <span>{t(key)}</span>
            <strong>
              {key === "balance" && summary[key] > 0 ? "+" : ""}
              {format(summary[key])}
              <small>{t("unit")}</small>
            </strong>
          </div>
        ))}
      </div>
    </div>
  );
}
