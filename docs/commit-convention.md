# Commit Convention

This repo uses [Conventional Commits](https://www.conventionalcommits.org/). Format:

```
type(scope): short imperative summary
```

Lowercase after the colon, no trailing period. The same rules apply to humans and AI agents. Renovate is configured (in [../renovate.json](../renovate.json)) to produce commits in this exact style, so hand-written history stays uniform.

PRs are always **squash-merged**, and the squash commit takes the **PR title** as its subject. So the PR title must follow this convention; the individual commits on a branch are squashed away.

## Types — pick by *what kind* of change it is

| Type | Use when | Example |
|---|---|---|
| `feat` | Adds a capability: new view, new data source, new config option | `feat(program): show block responsibles per day` |
| `fix` | Corrects broken behaviour | `fix(drive): handle shared drives without permission` |
| `chore` | Routine maintenance, no behaviour change. **All Renovate bumps land here** | `chore(deps): update next to v15.6.0` |
| `refactor` | Restructuring with no change in behaviour | `refactor(ecamp): split api client from mapping` |
| `build` | Tooling/config that builds or governs the repo: Dockerfile, compose, Renovate config, Claude settings | `build(docker): build image for arm64` |
| `ci` | GitHub Actions / pipeline changes | `ci: build pull requests without pushing` |
| `docs` | README, this guide | `docs: document docker hub usage` |
| `revert` | Reverting a previous commit | `revert: feat(program): ...` |

Not used in this repo: `perf`, `test`, `style` — skip them unless a real case appears.

## Scope — *what* the change touches

| Scope | Files |
|---|---|
| `auth` | `auth.ts`, `proxy.ts`, `app/login`, `app/api/auth` |
| `ecamp` | `lib/data/ecamp.ts` |
| `drive` | `lib/data/drive.ts` |
| `config` | `lib/data/config.ts`, `config/camps.example.json`, env vars |
| `program`, `people`, `termine`, `nav` | the matching view in `components/` and `app/[camp]` |
| `ui` | shared UI: `components/` (e.g. `ErrorNotice.tsx`, `icons.tsx`), `globals.css`, layout |
| `docker` | `Dockerfile`, `.dockerignore`, `docker-compose.yml` |
| `renovate` | `renovate.json` |
| `claude` | `.claude/`, `CLAUDE.md` |
| `deps` | dependency updates (`package.json`, lockfile, base images, GitHub Actions) |

- The scope is the **area of the app**, not the library. A googleapis bump made for Drive is still `chore(deps): …`; a code change in `lib/data/drive.ts` is `fix(drive): …`.
- **Multiple unrelated things in one commit** → drop the scope, or split the commit. Don't cram several names into one scope.

## Quick decision flow

1. New thing? → `feat`. Broken thing? → `fix`. Neither, just upkeep? → `chore` (or `build`/`ci`/`docs`).
2. Pick the scope from the table above, or omit it.
3. Imperative mood, lowercase after the colon, no trailing period.

## Renovate does this automatically

Bot PRs are titled `chore(deps): …` (e.g. `chore(deps): update dependency zod to v4.7.0`, `chore(deps): update all non-major dependencies`). Since the PR title becomes the squash commit, the history stays uniform without manual editing.
