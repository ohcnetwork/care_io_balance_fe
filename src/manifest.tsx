import { lazy } from "react";
import { getI18n } from "react-i18next";
import en from "../public/locale/en.json";
import { IO_SCHEMA } from "./lib/group";
import { validateIO } from "./lib/validate";
import type { PluginManifest } from "./types/host";
// Existing encounter tabs resolve labels in the host namespace.
getI18n()?.addResource(
  "en",
  "care_fe",
  "ENCOUNTER_TAB__io_balance",
  en.encounter_tab,
);
const manifest: PluginManifest = {
  plugin: "care_io_balance_fe",
  encounterTabs: {
    io_balance: lazy(() => import("./components/IOBalanceTab")),
  },
  registeredQuestionGroups: [
    {
      type: "care_io_balance_fe.io_balance",
      label: en.title,
      subjects: ["encounter"],
      repeats: true,
      schema: IO_SCHEMA,
      validate: validateIO,
      builder: lazy(() => import("./components/IOBuilder")),
      component: lazy(() => import("./components/IOBalanceInput")),
    },
  ],
};
export default manifest;
