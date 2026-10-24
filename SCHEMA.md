# I/O collection and emission contract

## Group and rows

- Plugin: `care_io_balance_fe`; group: `care_io_balance_fe.io_balance`.
- Encounter questionnaire only; `type: group`, `repeats: true`, `is_component: true`.
- One row is one consumed/administered/collected amount from one source, for an event or interval. Repeated sources and identical timestamps are allowed; timestamps are not identifiers.
- No default parent code: verified 8-hour/24-hour panel codes would incorrectly describe arbitrary entries. Source codes are on components.
- CARE owns UUIDs, subject/encounter, drafts, authorship and submission. Child UUIDs repeat across rows; `sub_results` preserves row scope.

## Ordinary child schema

| Key                | Type     | Rule                                                                          |
| ------------------ | -------- | ----------------------------------------------------------------------------- |
| `kind`             | choice   | Required; catalogue key below                                                 |
| `availability`     | choice   | Required: `known`, `unknown`, `not-performed`, `error`                        |
| `measured_at`      | dateTime | Required: event time or interval end; defaults to now, editable               |
| `period_start`     | dateTime | Optional interval start; must not exceed end                                  |
| `source`           | string   | Optional fluid/product/drain label                                            |
| `comment`          | text     | Optional note                                                                 |
| Each catalogue key | decimal  | Fixed LOINC code and UCUM mL; only the selected key can have a numeric answer |

The renderer presents **one volume input per row** and moves its value when the source changes. Other coded children stay empty and are omitted by the ordinary host serializer. Numeric children are optional in the saved definition; the plugin requires the selected one when availability is `known`. It validates finite, nonnegative values, mutually exclusive selected measurements, timing, and the saved code/unit configuration.

The coded children deliberately have no `enable_when`: the existing backend evaluates conditions before entering repeated rows. The renderer handles the source selection and validation without relying on unsupported row-local backend condition evaluation. Client validation is not server-side clinical validation; the existing API still accepts any values allowed by its own schema.

Zero is a real volume and emits. Empty is incomplete while availability is `known`. Explicit unavailable reasons clear the numeric answer and remain ordinary questionnaire answers. Optional blank answers are omitted, never submitted as empty scalar results. Missing/incompatible schema fields require editor repair before submission.

## Source catalogue

System `http://loinc.org`; unit `http://unitsofmeasure.org` / `mL`.

| Kind                | Direction | Code                                 |
| ------------------- | --------- | ------------------------------------ |
| `oral_measured`     | intake    | [9000-1](https://loinc.org/9000-1)   |
| `oral_estimated`    | intake    | [8999-5](https://loinc.org/8999-5)   |
| `enteral_measured`  | intake    | [8953-2](https://loinc.org/8953-2)   |
| `enteral_estimated` | intake    | [8952-4](https://loinc.org/8952-4)   |
| `iv_measured`       | intake    | [8975-5](https://loinc.org/8975-5)   |
| `iv_estimated`      | intake    | [8974-8](https://loinc.org/8974-8)   |
| `urine`             | output    | [9187-6](https://loinc.org/9187-6)   |
| `wound_drain`       | output    | [9203-1](https://loinc.org/9203-1)   |
| `blood_loss`        | output    | [81661-1](https://loinc.org/81661-1) |

The IV concept includes intravascular fluid/blood-product volumes; product identity is a source label. No generic 'other' is assigned a misleading source-specific code. This release does not offer separate estimated-output codes. Record actual amounts, not prescriptions, infusion rates or cumulative meter readings.

## Submitted example

Illustrative UUIDs; actual children have host-generated IDs and `${group.link_id}__${key}` scoped keys. One urine collection of 150 mL:

```json
{
  "question_id": "11111111-1111-4111-8111-111111111111",
  "sub_results": [
    [
      {
        "question_id": "22222222-2222-4222-8222-222222222222",
        "values": [{ "value": "urine" }]
      },
      {
        "question_id": "33333333-3333-4333-8333-333333333333",
        "values": [{ "value": "known" }]
      },
      {
        "question_id": "44444444-4444-4444-8444-444444444444",
        "values": [{ "value": "2026-09-28T09:00:00+05:30" }]
      },
      {
        "question_id": "55555555-5555-4555-8555-555555555555",
        "values": [{ "value": "2026-09-28T08:00:00+05:30" }]
      },
      {
        "question_id": "66666666-6666-4666-8666-666666666666",
        "values": [{ "value": "150" }],
        "note": "Measured at / collection end: 2026-09-28T03:30:00.000Z\nCollection start (optional): 2026-09-28T02:30:00.000Z"
      }
    ]
  ]
}
```

## Existing backend output

The example emits one panel Observation, with `value_type: group`, an empty top-level value, and:

```json
{
  "component": [
    {
      "code": {
        "system": "http://loinc.org",
        "code": "9187-6",
        "display": "Urine output"
      },
      "value": {
        "value": "150",
        "unit": {
          "system": "http://unitsofmeasure.org",
          "code": "mL",
          "display": "mL"
        }
      },
      "note": "Measured at / collection end: 2026-09-28T03:30:00.000Z\nCollection start (optional): 2026-09-28T02:30:00.000Z"
    }
  ]
}
```

Two known rows emit two panels, each with one volume component. An unavailable row emits a panel with no numeric components; the source/reason/time remain in the QuestionnaireResponse. Uncoded context questions emit no components. The existing backend may also emit an empty panel when an optional group has no rows; the history calculation ignores it.

`effective_datetime` is server submission time. There is no custom `effective_period`, `data_absent_reason`, migration, derived balance Observation or backend extension. Component notes mirror labels, collection timestamps and notes for human readback; calculations never parse notes. No claim is made that those notes are FHIR `effectivePeriod`.

## Fetching and calculations

The plugin receives the existing `patient` and `encounter` props and calls the existing patient Observation list endpoint using the host’s `window.CARE_API_URL` and `care_access_token` session key, filtered by the selected encounter, loading every page. It leaves groups included and does not filter by component code (the API's `codes` filter matches only `main_code`). The backend enforces access; failures discard partial totals and allow retry.

`encounterTabs.io_balance` renders the standalone I/O Balance view and loads on opening. Retry after failure fetches all pages again. Changing encounter resets the displayed result and aborts outstanding requests, so totals from one encounter cannot appear in another. The form contains only its own entry totals; it has no Observation history view or loader.

The plugin identifies known volume codes in `component[]`, accepts final/amended records, deduplicates Observation IDs, normalizes UCUM mL/L, and excludes malformed/negative/non-finite amounts and unsupported units with a visible excluded count. It sums intake and output separately and subtracts output from intake. Each component is counted once; repeated genuine entries remain distinct. API errors discard incomplete results and expose retry instead of showing partial totals.

Form totals and recorded totals are separate. Saved data is never added to unsaved rows automatically. Recorded timestamps are labeled **Recorded at**, and no shift/day measurement-time filtering or interval apportionment is offered. Unavailable amounts cannot be inferred from empty panels. Totals are of retrievable volume components, not evidence of complete charting.

The existing backend leaves Observation statuses unchanged when a form is marked entered-in-error; the read API omits the QuestionnaireResponse link. Consequently the frontend cannot automatically reconcile such corrections. Explicitly invalidated Observations are excluded, and the history view states the correction limitation. No client-side write or timestamp-based deduplication attempts to compensate.

## Compatibility

The input uses separate semantic Intake and Output tables, with one compact row per entry and no direction column. Source choices stay within their section. Each editable table has a trailing placeholder row. Its first edit promotes it through the ordinary host `addRow` callback and creates the next blank placeholder; untouched placeholders never enter `sub_results`, totals or validation. Readback and print omit placeholders. Inputs, native source dropdowns, textareas and buttons are packaged and styled in this plugin, including for remote loading; core supplies no new controls or callbacks. Labels appear once in the headers; each control retains an accessible label. Source, details and volume stay visible. Availability, measurement time, collection start and notes are collapsed by default and expand horizontally per table. Collapsing changes visibility only and retains all answers. Errors remain visible even for collapsed fields. Readback and print show optional details. Each table has a keyboard-focusable horizontal scroll region. The split is presentation-only: callbacks and serialized rows retain their original indices and order. Readback uses the same tables without editing controls. This layout change does not change stored child questions or answers and requires no schema repair.

The editor enables panel mode and owns schema repair. Filling never reconstructs a saved schema. Old draft definitions with conditional/required coded children are blocked and need repair. Ordinary saved rows render through CARE's readback adapter; missing fields show a repair message. Locks are honored for editing and row deletion. Read-only and print views have no mutation controls or live-history requests.

The supported backend behavior was checked in `care/emr/resources/questionnaire/utils.py` and the Observation viewset/read spec on the existing ENG-737 checkout. All implementation changes are frontend-only.

## Daily display

The encounter page groups existing volume components into 08:00–08:00 reporting days in the viewer’s local time. Morning (08:00–14:00), evening (14:00–20:00), and night (20:00–08:00) totals use Observation recording times. Empty shifts display a dash; recorded zero remains zero. Undated entries contribute only to the encounter-wide balance. Entry filters do not change daily totals. Source details remain ordinary answers and component notes; the page displays notes without parsing translated text into structured metadata. No rate, clinical alert, new Observation or schema field is introduced.
