import { useEffect } from "react";
import { useTranslation } from "../hooks/useTranslation";
import type { GroupBuilderProps } from "../types/host";
export default function IOBuilder({ question, onChange }: GroupBuilderProps) {
  const { t } = useTranslation();
  useEffect(() => {
    if (!question.is_component) onChange({ is_component: true });
  }, [question.is_component, onChange]);
  return (
    <div>
      <p>{t("builder_help")}</p>
      <label>
        <input
          type="checkbox"
          checked={!!question.required}
          onChange={(e) =>
            onChange({ required: e.target.checked, is_component: true })
          }
        />{" "}
        {t("require_entry")}
      </label>
    </div>
  );
}
