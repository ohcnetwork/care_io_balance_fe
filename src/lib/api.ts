import type { PanelObservation } from "./observations";

/** Uses CARE's existing runtime API URL and authenticated browser session. */
export async function loadObservations(
  patientId: string,
  encounterId: string,
  signal: AbortSignal,
): Promise<PanelObservation[]> {
  if (!patientId || !encounterId || typeof window.CARE_API_URL !== "string")
    throw new Error("Observation context unavailable");
  const entries: PanelObservation[] = [];
  const limit = 200;
  let count = Infinity;
  while (entries.length < count) {
    signal.throwIfAborted();
    const params = new URLSearchParams({
      encounter: encounterId,
      limit: String(limit),
      offset: String(entries.length),
    });
    const headers = new Headers({ Accept: "application/json" });
    const token = localStorage.getItem("care_access_token");
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const response = await fetch(
      `${window.CARE_API_URL.replace(/\/$/, "")}/api/v1/patient/${encodeURIComponent(patientId)}/observation/?${params}`,
      { headers, signal },
    );
    if (!response.ok)
      throw new Error(`Observation request failed (${response.status})`);
    const page = await response.json();
    if (
      !Array.isArray(page.results) ||
      !Number.isSafeInteger(page.count) ||
      page.count < 0
    )
      throw new Error("Invalid Observation page");
    count = page.count;
    if (!page.results.length && entries.length < count)
      throw new Error("Incomplete Observation results");
    entries.push(...page.results);
  }
  return entries;
}
