# pfadi-app

## Code organization

Keep the app readable for a beginner.

- **Screens go in `app/`.** This is the "pages" folder: Next.js App Router only finds screens there (`app/**/page.tsx`). Never create a `pages/` folder, because that switches Next.js to a different router.
- **Shared pieces go in `components/`**, one component per file, and the file is named after the component (`ErrorNotice.tsx`).
- **Saving and loading goes in `lib/data/`**: Drive, eCamp, the camps config, the loaders and the template copy. Pure helpers that need no network or file access (parsing, formulas, dates, CSV) go in `lib/`.
- **Never put code in the root `data/` folder.** That is where the running app saves camps (`DATA_DIR`), and Git and Docker both ignore it.
- **One job per file.** If a file does two things, split it.
- **No file over 300 lines.** Split it before it gets there.
- **Check before you write.** Search `components/` and `lib/` for something that already does the job, and reuse or extend it instead of adding a near-copy.
- Tests sit next to the file they test (`lib/termine.ts` → `lib/termine.test.ts`). Files reachable from a test import local values with the `.ts` extension, because tests run on plain Node.

## Commits

Follow the commit convention in [docs/commit-convention.md](docs/commit-convention.md): `type(scope): summary`, Conventional Commits, lowercase, imperative, no trailing period.

## Pull requests

- Never push to `main` directly; always branch off `origin/main` and open a PR.
- **PR titles must follow the commit convention** — PRs are squash-merged and the PR title becomes the commit on `main`.
- Merge only with **squash and merge**: `gh pr merge <n> --squash --delete-branch`. Merge commits and rebase merges are disabled on the repository.
- Every merge to `main` that touches image files pushes `lostiboy7/pfadi-app:develop` to Docker Hub; confirm merges with the user first.

## Releases

Use the `github-release` skill. Tags are `vX.Y.Z`; a published release pushes `lostiboy7/pfadi-app:vX.Y.Z` and `:latest` (multi-arch: amd64 + arm64).
