import { useCallback } from "react";
import { useTranslation } from "../hooks/useTranslation";
import { loadObservations } from "../lib/api";
import "../style/index.css";
import type { PluginEncounterTabProps } from "../types/host";
import IOHistory from "./IOHistory";

export default function IOBalanceTab({
  patient,
  encounter,
}: PluginEncounterTabProps) {
  const { t } = useTranslation();
  const patientId = patient?.id;
  const encounterId = encounter?.id;
  const load = useCallback(
    (signal: AbortSignal) => loadObservations(patientId, encounterId, signal),
    [patientId, encounterId],
  );
  return (
    <div className="care-io-balance-fe io-balance-tab">
      {patientId && encounterId ? (
        <IOHistory key={`${patientId}/${encounterId}`} load={load} />
      ) : (
        <p role="status">{t("history_unavailable")}</p>
      )}
    </div>
  );
}
