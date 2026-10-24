/** Subset of the host questionnaire group contract. Keep in sync with
 * care_fe/src/components/QuestionnaireV2/groups/registry.ts and question types. */
import type { ComponentType } from "react";

export interface Code {
  code: string;
  display?: string;
  system?: string;
}

export interface Question {
  id: string;
  link_id: string;
  text: string;
  description?: string;
  type:
    | "group"
    | "display"
    | "boolean"
    | "decimal"
    | "integer"
    | "date"
    | "dateTime"
    | "time"
    | "string"
    | "text"
    | "url"
    | "choice"
    | "quantity"
    | "structured";
  structured_type?: string;
  required?: boolean;
  code?: Code;
  unit?: Code;
  collect_time?: boolean;
  is_component?: boolean;
  enable_behavior?: "all" | "any";
  disabled_display?: "hidden" | "protected";
  read_only?: boolean;
  repeats?: boolean;
  questions?: Question[];
  answer_option?: { value: string; display?: string }[];
  enable_when?: ({ question: string } & (
    | {
        operator: "greater" | "less" | "greater_or_equals" | "less_or_equals";
        answer: number;
      }
    | { operator: "exists" | "equals" | "not_equals"; answer: boolean }
    | { operator: "equals" | "not_equals"; answer: string }
  ))[];
}

export interface ResponseValue {
  type: string;
  value?: unknown;
  coding?: Code;
  unit?: Code;
}

export interface QuestionnaireResponse {
  question_id: string;
  structured_type: string | null;
  link_id: string;
  values: ResponseValue[];
  sub_results?: QuestionnaireResponse[][];
  note?: string;
  taken_at?: string;
}

export type ResponsePath = { questionId: string; rowIndex: number }[];

export interface QuestionValidationError {
  question_id: string;
  response_path?: ResponsePath;
  error?: string;
  msg?: string;
  type?: string;
}

export type SubjectType =
  "patient" | "encounter" | "location" | "device" | "facility";

export type GroupQuestionDefinition = Omit<Question, "id" | "questions"> & {
  questions?: GroupQuestionDefinition[];
};

export interface GroupBuilderProps {
  question: Question;
  onChange: (patch: Partial<Question>) => void;
}

export interface GroupField {
  question: Question;
  response: QuestionnaireResponse;
  disabled: boolean;
  hidden: boolean;
  errors: readonly QuestionValidationError[];
}

export interface GroupRow {
  fields: Record<string, GroupField | null>;
  onChange: (updates: Record<string, Partial<QuestionnaireResponse>>) => void;
  remove: () => void;
}

export interface PluginEncounterTabProps {
  patient: { id: string };
  encounter: { id: string };
}

export interface GroupInputProps {
  question: Question;
  fields: Record<string, GroupField | null>;
  onChange: (updates: Record<string, Partial<QuestionnaireResponse>>) => void;
  disabled: boolean;
  rows: GroupRow[];
  addRow: (updates?: Record<string, Partial<QuestionnaireResponse>>) => void;
}

export interface RegisteredGroupDefinition {
  type: string;
  label: string;
  icon?: ComponentType<{ className?: string }>;
  subjects: readonly SubjectType[];
  repeats?: boolean;
  schema: readonly GroupQuestionDefinition[];
  builder: ComponentType<GroupBuilderProps>;
  component: ComponentType<GroupInputProps>;
  validate?: (
    question: Question,
    responses: Record<string, QuestionnaireResponse>,
    path: ResponsePath,
  ) => QuestionValidationError[];
}

export interface PluginManifest {
  plugin: string;
  encounterTabs?: Record<string, ComponentType<PluginEncounterTabProps>>;
  registeredQuestionGroups?: readonly RegisteredGroupDefinition[];
}
