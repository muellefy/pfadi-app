# pfadi-app

## Commits

Follow the commit convention in [docs/commit-convention.md](docs/commit-convention.md): `type(scope): summary`, Conventional Commits, lowercase, imperative, no trailing period.

## Pull requests

- Never push to `main` directly; always branch off `origin/main` and open a PR.
- **PR titles must follow the commit convention** — PRs are squash-merged and the PR title becomes the commit on `main`.
- Merge only with **squash and merge**: `gh pr merge <n> --squash --delete-branch`. Merge commits and rebase merges are disabled on the repository.
- Every merge to `main` that touches image files pushes `lostiboy7/pfadi-app:develop` to Docker Hub; confirm merges with the user first.

## Releases

Use the `github-release` skill. Tags are `vX.Y.Z`; a published release pushes `lostiboy7/pfadi-app:vX.Y.Z` and `:latest` (multi-arch: amd64 + arm64).
