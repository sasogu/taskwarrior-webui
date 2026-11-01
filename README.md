# Taskwarrior WebUI — independent Taskwarrior 2 fork

An independent fork of [DCsunset/taskwarrior-webui](https://github.com/DCsunset/taskwarrior-webui),
based on its Taskwarrior 2 code at `6566cbe`. The original authors retain their
copyright; this fork keeps the [GPL-3.0 license](LICENSE).

This version uses **Taskwarrior 2.6.2** as its single source of truth. It operates
directly on a Taskwarrior 2 data directory through the `task` executable. Its
storage is incompatible with Taskwarrior 3.

## Features

- Nested subtasks with foldable trees and completion progress, stored in the
  `webparent` UDA. See [SUBTASKS.md](docs/SUBTASKS.md).
- English, Spanish and Catalan, with a language selector and browser preference
  detection. A manual choice is remembered in that browser.
- Readable dates, calendar selectors and separate 24-hour time pickers.
  Changing the day preserves the existing time; opening a selector changes no data.
- Editable annotations and confirmed deletion. Changes apply when the task is
  saved; Cancel and Reset discard drafts. Original annotation timestamps remain.
- Projects, tags, priorities, scheduling, waiting, batch actions and responsive
  layouts with light/dark themes. Recurrence offers common presets (daily,
  weekdays, weekly, monthly…) plus a custom Taskwarrior syntax field.
- Conflict detection: a stale task update is rejected with HTTP 409.
- Tailscale identity authentication and a non-root Docker image.
- Taskwarrior commands execute with argument arrays rather than a shell.

Descriptions, project names and tags stay as entered. Date expressions such as
`tomorrow` and `+1w` retain Taskwarrior's syntax. Numeric dates follow the selected
language: `22/10/2026` in Spanish/Catalan and `10/22/2026` in English.

## Run with Docker and Tailscale

Requirements: Docker Compose, Tailscale with Serve available, and files writable
by container UID/GID `1000:1000`.

1. Copy `.env.example` to `.env`. Set `ALLOWED_LOGINS` to your Tailscale login and
   set `TASKRC_HOST` and `TASKDATA_HOST` to your Taskwarrior 2 configuration and
   data directory. Back up existing task data before connecting it.
2. Build and run:

   ```sh
   docker compose -f compose.example.yml up -d --build
   ```

3. Publish the loopback service inside your tailnet:

   ```sh
   tailscale serve --bg --https=8095 http://127.0.0.1:8096
   ```

4. Open `https://<your-node>.<your-tailnet>.ts.net:8095` with Tailscale connected.
   Reload with Ctrl+Shift+R if an installed PWA retains older resources.

Tailscale Serve supplies `Tailscale-User-Login`; the backend only accepts logins
listed in `ALLOWED_LOGINS`. Keep the backend bound to loopback behind that trusted
proxy. A missing/unauthorized identity receives HTTP 403. Authentication is
independent of external identity providers.

For a new isolated store, create a `data` directory and a `taskrc` file containing
`data.location=/data`, then use their paths in `.env`. Existing `.taskrc` settings
and hooks may require additional files or mounts; check them for your deployment.

## Tests

Build the development stage and run the unit tests:

```sh
docker build --target build -t taskwarrior-webui-tests .
docker run --rm -v "$PWD/tests:/src/tests:ro" -w /src taskwarrior-webui-tests \
  node --test tests/hierarchy.test.cjs tests/i18n.test.cjs tests/dates.test.cjs
```

The `tests/browser-*.mjs` scripts use Playwright/Chromium against a disposable API
container with synthetic tasks. `TASKWEB_TEST_URL` defaults to
`http://127.0.0.1:18097`; `TASKWEB_PLAYWRIGHT` can specify the installed Playwright
module. The test identity is `subtasks@example.invalid`. `browser-dates.mjs`
requires an empty store. `tests/api-subtasks.py` also requires an empty disposable
store. These scripts create and modify test tasks; use isolated data directories.
`browser-responsive.mjs` checks the touch/tablet card layout (iPad portrait and
landscape, phone, desktop table); set `TASKWEB_ENGINE=webkit` to run it in WebKit.
`browser-theme.mjs` checks that the dark theme choice persists after reloading,
both from the toolbar button and from the settings dialog. `browser-mode.mjs`
checks that the Tasks/Projects display mode is remembered across reloads.
`browser-sort.mjs` checks that the card-view sort order is remembered across reloads.
`browser-recur.mjs` creates a recurring task with a preset and edits it to a custom
period, checking the stored `recur` value.
Browser tests expect a fresh synthetic store: accumulated data can paginate the table.

## Roadmap

See [ROADMAP.md](ROADMAP.md). Annotation editing/deletion is complete. The remaining
phases are deferred: start/stop, search/filters, dependencies, contexts/reports,
and safe undo of web actions. No further implementation is scheduled automatically.

The UI still contains inherited taskserver sync settings; `/api/sync` is disabled
in this version. Refresh reads the shared local Taskwarrior store.

## Project lineage

The local project originally imported a snapshot of upstream `6566cbe`, then
recorded its changes as separate commits. Publication connects that local history
to the original upstream commit, preserving both histories and the existing patch
commits. This fork is maintained independently; upstream pull requests are not
part of the current plan.

## License

[GNU GPL version 3](LICENSE).
