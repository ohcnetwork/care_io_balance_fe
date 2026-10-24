# CARE I/O Balance

A frontend questionnaire plugin for multiple intake/output entries and recorded encounter totals. Uses the existing CARE backend; no backend patches or migrations.

- **Intake / Output:** separate compact tables with one row per entry. Each section always has a trailing blank row and its own source choices; labels appear once in the column headers. Editing the blank row adds it to the form and reveals another blank row. Untouched placeholders are excluded from totals and submission. Source, details and volume stay visible. Expand columns for availability, measurement time, collection start and notes, following the MedicationRequest pattern. Narrow screens scroll horizontally.
- Supports zero, measured/estimated intake, unavailable-volume reasons, labels and notes.
- Each submitted entry creates a panel Observation. A known amount becomes one source-specific coded component with a UCUM mL unit.
- Form totals update while editing. Saved encounter history appears only in the **I/O Balance** encounter tab.
- Saved answers and print retain the collection details.
- **I/O Balance encounter tab:** automatically loads saved Observation panels for the selected encounter, with daily intake/output/net cards, hourly bars, shift totals, source breakdowns and a filterable entry log. The chart date defaults to the latest recorded day and covers 08:00–08:00 in the viewer’s local time. All temporal summaries use recording times, not clinical collection times. Urine is shown in mL; no weight-based rate or clinical threshold is inferred. The encounter-wide balance stays visible separately. Retry appears only on failure.

See [SCHEMA.md](SCHEMA.md) for fields, serialized examples, exact emitted records and backend limits.

## Install and author

Place this directory at `care_fe/apps/care_io_balance_fe` and run `npm install` here. Start the host with `CARE_LOCAL_PLUGIN=1 portless` (or `CARE_LOCAL_PLUGIN=1 npm run dev` if unavailable). In an encounter questionnaire, select **Group → Intake / output balance**. The builder enables panel mode (`is_component: true`). Save and reload the definition before use.

The form uses the existing group bindings and validation. All controls and styling are packaged inside this plugin. The encounter tab receives the existing `patient` and `encounter` props, reads `window.CARE_API_URL` and CARE’s `care_access_token` session key, and fetches every page of the existing Observation API with encounter scoping and cancellation. It requires no core callback or additional endpoint. The plugin supplies its encounter-tab label at runtime.

The manifest registers `encounterTabs.io_balance`; the host labels it **I/O Balance**. Enable the plugin to display the tab alongside the other encounter tabs. No questionnaire must be open to view saved totals.

Existing forms built from the earlier draft need **Repair schema** in the editor and panel mode enabled. The renderer does not rewrite stored definitions or historical responses.

## Build and checks

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run preview
```

Ship all of `dist`, including `assets/remoteEntry.js`, chunks, CSS and `locale`. Enable using CARE's normal remote plugin configuration with slug `care_io_balance_fe`. The plugin shares React, ReactDOM and react-i18next with the host and scopes CSS to `.care-io-balance-fe`.

Host checks (run from `care_fe`):

```sh
npm run typecheck
npm run test:unit
# Existing local backend, current auth fixtures and locally enabled plugin required:
CARE_IO_URL=http://127.0.0.1:4011 npx playwright test -c apps/care_io_balance_fe/playwright.config.ts
# Local/remote rendering checks, without a backend:
CARE_IO_URL=http://127.0.0.1:4011 CARE_IO_REMOTE_URL=http://127.0.0.1:4181/assets/remoteEntry.js npx playwright test -c apps/care_io_balance_fe/playwright.config.ts -g 'plugin supports'
```

## Limits

Collection time is saved in ordinary form answers and readable component notes. The Observation timestamp remains the server's recording time. Daily and shift summaries use recording times; encounter balance includes all loaded entries. Unavailable entries have no numeric component and are excluded from recorded volume totals.

The backend does not propagate a questionnaire response's entered-in-error status to its Observations, and its Observation read API omits the response link. The history view excludes Observations explicitly marked entered-in-error, but cannot automatically reconcile corrected forms. It displays this limitation beside recorded totals; review the entries when corrections are involved.
