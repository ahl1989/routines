# Routines

A small offline-first app for building routines (steps with optional timers) and running them one step at a time.

- Each step can have a timer, a checklist and a note.
- Installable on a phone (PWA). Works offline after the first load.
- No account, no tracking. Data stays in the browser's storage on your device.
- Export and import backups from Settings.

Plain HTML, CSS and JavaScript. No build step. The font (Nunito) is bundled under the SIL Open Font License.

## Sync

Settings → GitHub sync keeps `data.json` (routines, history, Fit-to-time memory) in a private repo you own, using a fine-grained token limited to that repo (Contents: read and write). The phone keeps a local copy and works offline.
