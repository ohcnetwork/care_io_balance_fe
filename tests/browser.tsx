/* eslint-disable react-refresh/only-export-components -- Browser test harness exports. */
import i18next from "i18next";
import { Suspense, useState, type ComponentType } from "react";
import { createRoot } from "react-dom/client";
import { initReactI18next } from "react-i18next";
import { serializeQuestionResults } from "../../../src/components/QuestionnaireV2/fill/submit/serializeQuestionResults";
import { initializeResponses } from "../../../src/components/QuestionnaireV2/form/engine/store";
import { collectQuestionErrors } from "../../../src/components/QuestionnaireV2/form/validation";
import {
  groupBindings,
  updateGroupRows,
} from "../../../src/components/QuestionnaireV2/groups/bindings";
import { RegisteredGroupAnswerView } from "../../../src/components/QuestionnaireV2/groups/RegisteredGroupAnswerView";
import {
  registerQuestionGroup,
  type RegisteredGroupDefinition,
} from "../../../src/components/QuestionnaireV2/groups/registry";
import { instantiateGroupQuestions } from "../../../src/components/QuestionnaireV2/groups/schema";
import type { QuestionValidationError } from "../../../src/types/questionnaire/batch";
import type { QuestionnaireResponse } from "../../../src/types/questionnaire/form";
import type { Question } from "../../../src/types/questionnaire/question";
import type { PluginEncounterTabProps } from "../src/types/host";
export { default as React } from "react";
export { default as ReactDOM } from "react-dom";
export * as reactI18next from "react-i18next";

export async function mountIO(
  definition: RegisteredGroupDefinition,
  slug: string,
  Tab: ComponentType<PluginEncounterTabProps>,
) {
  await i18next
    .use(initReactI18next)
    .init({ lng: "en", resources: {}, interpolation: { escapeValue: false } });
  registerQuestionGroup(definition, slug);
  const question: Question = {
    id: crypto.randomUUID(),
    link_id: "io",
    text: "I/O balance",
    type: "group",
    repeats: true,
    is_component: true,
    required: true,
    structured_type: definition.type,
  };
  question.questions = instantiateGroupQuestions(question, definition.schema);
  function Harness() {
    const [responses, setResponses] = useState(() =>
      initializeResponses([question]),
    );
    const [errors, setErrors] = useState<QuestionValidationError[]>([]);
    const [saved, setSaved] = useState(false);
    const [locked, setLocked] = useState(false);
    const [showTab, setShowTab] = useState(false);
    const Component = definition.component;
    const rows = (responses[question.id].sub_results ?? []).map(
      (row, rowIndex) => ({
        fields: groupBindings(
          question,
          definition,
          [question],
          {
            ...responses,
            ...Object.fromEntries(row.map((r) => [r.question_id, r])),
          },
          errors.filter((e) => e.response_path?.[0]?.rowIndex === rowIndex),
          locked,
        ),
        onChange: (updates: Record<string, Partial<QuestionnaireResponse>>) =>
          setResponses((current) =>
            updateGroupRows(question, definition, [question], current, {
              type: "update",
              row,
              updates,
            }),
          ),
        remove: () =>
          setResponses((current) =>
            updateGroupRows(question, definition, [question], current, {
              type: "remove",
              row,
            }),
          ),
      }),
    );
    const serialized = serializeQuestionResults([question], responses);
    if (showTab)
      return (
        <Suspense fallback="Loading">
          <Tab
            patient={{ id: "io-test-patient" }}
            encounter={{ id: "io-test-encounter" }}
          />
        </Suspense>
      );
    return (
      <Suspense fallback="Loading">
        <h1>I/O balance</h1>
        <button type="button" onClick={() => setShowTab(true)}>
          Open I/O tab
        </button>
        {errors
          .filter((error) => error.question_id === question.id)
          .map((error, index) => (
            <p role="alert" key={index}>
              {error.error}
            </p>
          ))}
        {saved ? (
          <RegisteredGroupAnswerView
            question={question}
            responses={serialized}
            fallback="Unavailable"
          />
        ) : (
          <>
            <Component
              question={question}
              fields={groupBindings(
                question,
                definition,
                [question],
                {
                  ...responses,
                  ...initializeResponses(question.questions ?? []),
                },
                [],
                locked,
              )}
              rows={rows}
              onChange={() => {}}
              disabled={locked}
              addRow={(updates) =>
                setResponses((current) =>
                  updateGroupRows(question, definition, [question], current, {
                    type: "add",
                    updates: updates ?? {},
                  }),
                )
              }
            />
            <label>
              <input
                type="checkbox"
                checked={locked}
                onChange={(e) => setLocked(e.target.checked)}
              />
              Lock chart
            </label>
            <button
              type="button"
              onClick={() => {
                const next = collectQuestionErrors(
                  [question],
                  responses,
                  i18next.t,
                  {
                    questionnaire: {
                      subject_type: "encounter",
                      questions: [question],
                    },
                    subject: {},
                    renderFailed: new Set(),
                  },
                );
                setErrors(next);
                if (!next.length) setSaved(true);
              }}
            >
              Save test response
            </button>
          </>
        )}
        <pre
          id="submitted"
          data-questions={JSON.stringify(question.questions)}
          hidden
        >
          {JSON.stringify(serialized)}
        </pre>
      </Suspense>
    );
  }
  createRoot(document.getElementById("root")!).render(<Harness />);
}
