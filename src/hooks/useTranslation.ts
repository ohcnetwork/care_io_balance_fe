import { useCallback } from "react";
import { useTranslation as useTranslationBase } from "react-i18next";

import en from "../../public/locale/en.json";

/** The plugin's i18n namespace — its slug, which the host registers and
 *  serves from `<plugin origin>/locale/<lng>.json`. */
export const NAMESPACE = "care_io_balance_fe";

/** Use English defaults while CARE loads the plugin namespace. */
export function useTranslation() {
  const { t: base, i18n } = useTranslationBase(NAMESPACE);
  const t = useCallback(
    (key: string, options?: Record<string, unknown>) =>
      base(key, {
        defaultValue: en[key as keyof typeof en] ?? key,
        ...options,
      }),
    [base],
  );
  return { t, i18n };
}
