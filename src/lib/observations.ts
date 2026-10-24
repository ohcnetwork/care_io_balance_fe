import type { Code } from "../types/host";
import { KINDS } from "./group";

export interface PanelObservation {
  id: string;
  status: string;
  effective_datetime: string;
  component?: {
    code?: Code | null;
    value: { value?: string | null; unit?: Code };
    note?: string;
  }[];
}

/** Components carry source codes; panel timestamps are recording times only. */
export function summarizeObservations(observations: PanelObservation[]) {
  const entries: {
    id: string;
    kind: (typeof KINDS)[number];
    volume: number;
    recordedAt: string;
    note: string;
  }[] = [];
  const seen = new Set<string>();
  let skipped = 0;
  for (const observation of observations) {
    if (seen.has(observation.id)) continue;
    seen.add(observation.id);
    if (!["final", "amended"].includes(observation.status)) continue;
    for (const [index, component] of (observation.component ?? []).entries()) {
      const kind =
        component.code?.system === "http://loinc.org"
          ? KINDS.find((k) => k.code === component.code?.code)
          : undefined;
      if (!kind) continue;
      const raw = component.value.value;
      const unit = component.value.unit;
      const factor =
        unit?.system === "http://unitsofmeasure.org"
          ? ({ mL: 1, L: 1000 }[unit.code] ?? NaN)
          : NaN;
      const volume =
        raw == null || raw.trim() === "" ? NaN : Number(raw) * factor;
      if (!Number.isFinite(volume) || volume < 0) {
        skipped++;
        continue;
      }
      entries.push({
        id: `${observation.id}:${index}`,
        kind,
        volume,
        recordedAt: observation.effective_datetime,
        note: component.note ?? "",
      });
    }
  }
  const input = entries
    .filter((e) => e.kind.direction === "input")
    .reduce((total, e) => total + e.volume, 0);
  const output = entries
    .filter((e) => e.kind.direction === "output")
    .reduce((total, e) => total + e.volume, 0);
  return { input, output, balance: input - output, entries, skipped };
}

type Entry = ReturnType<typeof summarizeObservations>["entries"][number];

/** The reporting day runs from 08:00 to 08:00 in the viewer's local time. */
export function reportingDay(timestamp: string) {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return "";
  if (date.getHours() < 8) date.setDate(date.getDate() - 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function dailyReport(entries: Entry[], day: string) {
  const selected = entries.filter(
    (entry) => reportingDay(entry.recordedAt) === day,
  );
  const sum = (items: Entry[]) => {
    const input = items
      .filter((entry) => entry.kind.direction === "input")
      .reduce((total, entry) => total + entry.volume, 0);
    const output = items
      .filter((entry) => entry.kind.direction === "output")
      .reduce((total, entry) => total + entry.volume, 0);
    const urine = items
      .filter((entry) => entry.kind.key === "urine")
      .reduce((total, entry) => total + entry.volume, 0);
    return { input, output, balance: input - output, urine };
  };
  const start = new Date(`${day}T08:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const hours = [];
  // Advance by elapsed hours so daylight-saving days retain every recorded hour.
  for (let time = start.getTime(); time < end.getTime(); time += 3600000) {
    const items = selected.filter((entry) => {
      const recorded = new Date(entry.recordedAt).getTime();
      return recorded >= time && recorded < time + 3600000;
    });
    hours.push({ time, count: items.length, ...sum(items) });
  }
  const shifts = [
    { key: "morning", range: "08:00–14:00", from: 0, to: 6 },
    { key: "evening", range: "14:00–20:00", from: 6, to: 12 },
    { key: "night", range: "20:00–08:00", from: 12, to: 24 },
  ].map((shift) => {
    const items = selected.filter((entry) => {
      const hour = (new Date(entry.recordedAt).getHours() + 16) % 24;
      return hour >= shift.from && hour < shift.to;
    });
    return { ...shift, count: items.length, ...sum(items) };
  });
  const sources = KINDS.map((kind) => {
    const items = selected.filter((entry) => entry.kind.key === kind.key);
    return {
      kind,
      count: items.length,
      volume: items.reduce((total, entry) => total + entry.volume, 0),
    };
  })
    .filter((source) => source.count)
    .sort((a, b) => b.volume - a.volume);
  return {
    ...sum(selected),
    entries: selected.sort(
      (a, b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt),
    ),
    hours,
    shifts,
    sources,
  };
}
