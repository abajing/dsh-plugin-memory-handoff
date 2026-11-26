# dsh-plugin-memory-handoff

> Cross-session memory handoff for DeepSeek Harness — keep progress **outside** the context, surface unfinished work **once** per session, and archive compaction summaries so nothing is silently lost.

MIT · Works with plain `dsh web` and DSH Desktop / DSH Next.

---

## The gap it fills

DSH already manages sessions well: persistence, resume, replay, full-text search, compaction, forking. But those are **records**, not **memory**.

Three real gaps:

| Gap | Symptom | What this plugin does |
|---|---|---|
| Cross-session memory | A new session does not know "that task is still unfinished" — so it redoes it or forgets it | Reads a handoff file, prints one line at session start |
| Status | Everything looks unfinished, so the list gets read out loud every time | `pending` / `done` / `dropped`; `dropped` never comes back |
| Compaction loses detail | After compaction the early reasoning is gone | Subscribes to compaction events, archives the summary and the shadowed range |

**What it deliberately does not do** (no overlap with the platform):

- Does not take over compaction — `compaction-basic` already implements the threshold `min(W×0.8, W−O−65536)`;
- Does not refactor session storage — `session-persistence` owns that;
- Does not fork automatically — `remote.session.fork` is a platform contract; the caller decides when.

---

## Install

```bash
dsh plugin add dsh-plugin-memory-handoff
```

Or mount it explicitly in your profile's `cordis.patch.yml`:

```yaml
- insert:
    - id: memory-handoff
      name: dsh-plugin-memory-handoff
      config:
        maxHints: 3
```

## Config

| Key | Default | Description |
|---|---|---|
| `storePath` | `$DSH_HOME/memory-handoff.json` | Where the handoff file lives |
| `maxHints` | `3` | Max unfinished items shown at once (cap 9) |
| `recordShadowedRange` | `true` | Record the shadowed event range when compaction is archived |

## Data format

`memory-handoff.json`:

```json
{
  "version": 1,
  "items": [
    {
      "id": "a1",
      "title": "30s montage",
      "status": "pending",
      "did": "rendered a sample",
      "next": "ask for a verdict on the first 10s",
      "updatedAt": "2026-11-26T00:00:00Z"
    }
  ],
  "lastCompaction": {
    "at": "2026-11-26T01:46:53Z",
    "compactionId": "c-001",
    "turn": 7,
    "summary": "20 turns so far: ran the sandbox, fixed 4 real defects",
    "shadowed": { "start": 3, "end": 41 }
  }
}
```

`status` is one of `pending` (surfaced), `done` (silent), `dropped` (**never surfaced again**).

---

## Implementation notes (verified against upstream source)

- **Compaction events**: `compaction/start` and `compaction/end` — verified present in the installed runtime (`@deepseek-ai/dsh-desktop-runtime 0.2.1-rc.5`), and declared in `packages/compaction/compaction/src/types.ts` where the comments mark the pair as contractual. `compaction/end` carries `summary`, `shadowedRange`, `shadowedSeqs`.
- **Session-start hook**: `session/start` does **not** exist in this runtime. The plugin listens on `turn/start` and fires its one-line hint only once per session, resetting after `session/fork`.
- **Compaction threshold**: `packages/compaction/compaction-basic` documents `min(W×0.8, W−O−65536)`, configurable via `thresholdRatio` / `headroomTokens` / `retainTokens`.
- **Fork contract**: `packages/api/session-controller/src/types.ts` defines `SessionForkRequest { sessionId, atSeq?, allowMigration? }`, implemented by `fork()` in `commands.ts`.

## Known limitations

- Compaction is **lossy**. Archiving the summary does not archive the detail. Preserving detail means persisting raw events before compaction — a decision for the caller, not this plugin.
- Upstream `dsh-compaction@0.0.1-rc.5` requires `dsh-session@^0.0.1-rc.5`, while npm only publishes `dsh-session` up to `rc.1`. Installing it needs `--legacy-peer-deps`. This is an upstream version-chain issue, not something this plugin introduces.

## Test

```bash
npm run build
node tests/smoke.mjs
```

Currently: 10 assertions, all passing (mount, compaction archive, range recording, status filtering, empty store, `session/start` does not write, read/write round trip).

## License

MIT
