import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "../hooks/useTranslation";
import type { PanelObservation } from "../lib/observations";
import {
  dailyReport,
  reportingDay,
  summarizeObservations,
} from "../lib/observations";
import { Button, Input } from "./controls";

export default function IOHistory({
  load,
}: {
  load: (signal: AbortSignal) => Promise<PanelObservation[]>;
}) {
  const { t } = useTranslation();
  const controller = useRef<AbortController | null>(null);
  const [result, setResult] =
    useState<ReturnType<typeof summarizeObservations>>();
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [day, setDay] = useState("");
  const [filter, setFilter] = useState("all");
  const refresh = useCallback(async () => {
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    setStatus("loading");
    setResult(undefined);
    try {
      const observations = await load(request.signal);
      if (!request.signal.aborted) {
        setResult(summarizeObservations(observations));
        setStatus("ready");
      }
    } catch {
      if (!request.signal.aborted) setStatus("error");
    }
  }, [load]);
  useEffect(() => {
    void refresh();
    return () => controller.current?.abort();
  }, [refresh]);
  const format = (value: number) =>
    new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 }).format(
      value,
    );
  const signed = (value: number) => `${value > 0 ? "+" : ""}${format(value)}`;
  const dates = [
    ...new Set(
      result?.entries
        .map((entry) => reportingDay(entry.recordedAt))
        .filter(Boolean),
    ),
  ]
    .sort()
    .reverse();
  const selectedDay = day || dates[0] || reportingDay(new Date().toISOString());
  const report = dailyReport(result?.entries ?? [], selectedDay);
  const entries = report.entries.filter(
    (entry) => filter === "all" || entry.kind.direction === filter,
  );
  const max = Math.max(
    1,
    ...report.hours.flatMap((hour) => [hour.input, hour.output]),
  );
  const timeFormat = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  return (
    <section
      className="io-history"
      aria-label={t("history_title")}
      aria-busy={status === "loading"}
    >
      <header className="io-page-heading">
        <div>
          <h2>{t("page_title")}</h2>
          <p>{t("history_tab_scope")}</p>
        </div>
        <label className="io-date-filter">
          <span>{t("reporting_date")}</span>
          <Input
            type="date"
            aria-label={t("reporting_date")}
            value={selectedDay}
            onChange={(event) => setDay(event.target.value)}
          />
        </label>
      </header>
      <p className="io-scope">{t("reporting_scope")}</p>
      {status === "loading" && (
        <p role="status" className="io-empty">
          {t("loading")}
        </p>
      )}
      {status === "error" && (
        <div className="io-error">
          <p role="alert">{t("history_error")}</p>
          <Button type="button" onClick={refresh}>
            {t("retry")}
          </Button>
        </div>
      )}
      {result && (
        <>
          <div className="io-summary">
            {(["input", "output", "balance"] as const).map((key) => (
              <div key={key}>
                <span>
                  {key !== "balance" && (
                    <span
                      className={`io-marker io-${key}`}
                      aria-hidden="true"
                    />
                  )}
                  {t(`total_${key}`)}
                </span>
                <strong>
                  {key === "balance"
                    ? signed(report[key])
                    : format(report[key])}
                  <small>{t("unit")}</small>
                </strong>
              </div>
            ))}
          </div>
          <div className="io-encounter-total">
            <span>{t("encounter_balance")}</span>
            <b>
              {signed(result.balance)} {t("unit")}
            </b>
          </div>
          {!!result.skipped && (
            <p role="status">
              {t("history_skipped", { count: result.skipped })}
            </p>
          )}
          {result.entries.some((entry) => !reportingDay(entry.recordedAt)) && (
            <p role="status">{t("history_undated")}</p>
          )}
          {!report.entries.length ? (
            <div className="io-card io-empty" role="status">
              {t("history_empty")}
            </div>
          ) : (
            <>
              <section
                className="io-card io-hourly"
                aria-label={t("hourly_title")}
              >
                <div className="io-card-heading">
                  <h3>{t("hourly_title")}</h3>
                  <div className="io-legend">
                    {(["input", "output"] as const).map((direction) => (
                      <span key={direction}>
                        <span
                          className={`io-marker io-${direction}`}
                          aria-hidden="true"
                        />
                        {t(direction)}
                      </span>
                    ))}
                  </div>
                </div>
                <p className="io-scope">{t("hourly_scope")}</p>
                <div
                  className="io-table-scroll"
                  tabIndex={0}
                  role="region"
                  aria-label={t("hourly_title")}
                >
                  <div className="io-hour-chart">
                    {report.hours.map((hour) => {
                      const label = timeFormat.format(hour.time);
                      const description = hour.count
                        ? t("hour_summary", {
                            time: label,
                            input: format(hour.input),
                            output: format(hour.output),
                          })
                        : t("hour_empty", { time: label });
                      return (
                        <div
                          className="io-hour"
                          key={hour.time}
                          tabIndex={0}
                          aria-label={description}
                        >
                          <div className="io-hour-positive">
                            <div
                              className="io-input"
                              style={{ height: `${(hour.input / max) * 100}%` }}
                            />
                          </div>
                          <div className="io-hour-negative">
                            <div
                              className="io-output"
                              style={{
                                height: `${(hour.output / max) * 100}%`,
                              }}
                            />
                          </div>
                          <span className="io-hour-label">{label}</span>
                          <span className="io-chart-tooltip" role="tooltip">
                            {description}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>
              <div className="io-breakdowns">
                <section className="io-card" aria-label={t("by_shift")}>
                  <div className="io-card-heading">
                    <h3>{t("by_shift")}</h3>
                    <span className="io-muted">{t("unit")}</span>
                  </div>
                  <div
                    className="io-table-scroll"
                    tabIndex={0}
                    role="region"
                    aria-label={t("by_shift")}
                  >
                    <table className="io-shift-table">
                      <thead>
                        <tr>
                          {["shift", "input", "output", "balance", "urine"].map(
                            (key) => (
                              <th scope="col" key={key}>
                                {t(key)}
                              </th>
                            ),
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {report.shifts.map((shift) => (
                          <tr key={shift.key}>
                            <th scope="row">
                              {t(shift.key)}
                              <span className="io-muted io-block">
                                {shift.range}
                              </span>
                            </th>
                            {(
                              ["input", "output", "balance", "urine"] as const
                            ).map((key) => (
                              <td key={key}>
                                {shift.count
                                  ? key === "balance"
                                    ? signed(shift[key])
                                    : format(shift[key])
                                  : "—"}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="io-card-footnote">{t("shift_scope")}</p>
                </section>
                <section className="io-card" aria-label={t("by_source")}>
                  <div className="io-card-heading">
                    <h3>{t("by_source")}</h3>
                    <span className="io-muted">{t("unit")}</span>
                  </div>
                  <div className="io-sources">
                    {(["input", "output"] as const).map((direction) => (
                      <div key={direction}>
                        <h4>
                          <span
                            className={`io-marker io-${direction}`}
                            aria-hidden="true"
                          />
                          {t(direction)}
                        </h4>
                        {!report.sources.some(
                          (source) => source.kind.direction === direction,
                        ) && (
                          <p className="io-muted">{t(`empty_${direction}`)}</p>
                        )}
                        {report.sources
                          .filter(
                            (source) => source.kind.direction === direction,
                          )
                          .map((source) => (
                            <div className="io-source" key={source.kind.key}>
                              <div>
                                <span>{t(source.kind.key)}</span>
                                <b>{format(source.volume)}</b>
                              </div>
                              <div
                                className="io-source-track"
                                aria-hidden="true"
                              >
                                <div
                                  className={`io-${direction}`}
                                  style={{
                                    width: `${report[direction] ? (source.volume / report[direction]) * 100 : 0}%`,
                                  }}
                                />
                              </div>
                            </div>
                          ))}
                      </div>
                    ))}
                  </div>
                </section>
              </div>
              <section className="io-card" aria-label={t("entries")}>
                <div className="io-card-heading">
                  <h3>
                    {t("entries")}{" "}
                    <span className="io-count">{entries.length}</span>
                  </h3>
                  <div
                    className="io-filter"
                    role="group"
                    aria-label={t("filter_entries")}
                  >
                    {["all", "input", "output"].map((key) => (
                      <Button
                        type="button"
                        key={key}
                        aria-pressed={filter === key}
                        onClick={() => setFilter(key)}
                      >
                        {t(key)}
                      </Button>
                    ))}
                  </div>
                </div>
                <div
                  className="io-table-scroll"
                  tabIndex={0}
                  role="region"
                  aria-label={t("entries")}
                >
                  <table className="io-history-entries">
                    <thead>
                      <tr>
                        {["recorded_at", "type", "kind", "notes", "volume"].map(
                          (key) => (
                            <th scope="col" key={key}>
                              {t(key)}
                            </th>
                          ),
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((entry) => (
                        <tr key={entry.id}>
                          <td>
                            <time dateTime={entry.recordedAt}>
                              {new Date(entry.recordedAt).toLocaleString(
                                undefined,
                                {
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                },
                              )}
                            </time>
                          </td>
                          <td>
                            <span className="io-badge">
                              <span
                                className={`io-marker io-${entry.kind.direction}`}
                                aria-hidden="true"
                              />
                              {t(entry.kind.direction)}
                            </span>
                          </td>
                          <td>{t(entry.kind.key)}</td>
                          <td className="io-notes">{entry.note || "—"}</td>
                          <td className="io-numeric">{format(entry.volume)}</td>
                        </tr>
                      ))}
                      {!entries.length && (
                        <tr>
                          <td colSpan={5} className="io-empty">
                            {t("filter_empty")}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
          <p className="io-scope io-limits">{t("history_limits")}</p>
        </>
      )}
    </section>
  );
}
