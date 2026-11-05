---
name: github-release
description: 'Create a new GitHub release for pfadi-app, which publishes lostiboy7/pfadi-app:<tag> and :latest to Docker Hub. USE FOR: creating a release, drafting release notes, tagging a new version. DO NOT USE FOR: the :develop image (that is built automatically on every merge to main).'
argument-hint: 'Version to release, e.g. 1.1.0'
---

# GitHub Release for pfadi-app

Publishing a release triggers `.github/workflows/docker.yml`, which builds the
image and pushes `lostiboy7/pfadi-app:<tag>` and (unless it is a pre-release)
`:latest`. Production servers pulling `:latest` get it on their next
`docker compose pull && docker compose up -d`. **Confirm version and notes with
the user before Step 6.**

## Versioning

Semantic Versioning, tag format `vX.Y.Z` (with `v`), title `Release X.Y.Z`
(without `v`). The Docker tag is the release tag verbatim (`v1.1.0`).

| Part | When to increment |
|------|-------------------|
| MAJOR | Breaking changes for operators: new required env vars, changed `camps.json` format, changed volumes/ports |
| MINOR | New features in the app |
| PATCH | Bug fixes, dependency updates only |

Also bump `"version"` in `package.json` to match (via a normal PR, merged
before tagging).

## Procedure

### Step 1: Find the last release

```bash
git fetch --tags origin
git tag -l 'v*' --sort=-v:refname | head -5
GH_PAGER="" gh release list --limit 5
```

If there is no tag yet, this is the first release; compare against the root
commit and propose `v1.0.0` (matches `package.json`).

### Step 2: Gather changes

```bash
LAST=<last-tag>   # or $(git rev-list --max-parents=0 HEAD) for the first release
GH_PAGER="" gh pr list --state merged --base main --limit 100 \
  --search "merged:>=$(git log -1 --format=%cs $LAST)" \
  --json number,title,author,labels
git log $LAST..origin/main --oneline --no-merges
```

### Step 3: Check for operator-facing changes

These decide MAJOR vs MINOR and fill "Upgrade notes":

```bash
git diff $LAST..origin/main -- .env.example config/camps.example.json docker-compose.yml Dockerfile
```

New or renamed env vars, a changed `camps.json` schema, or changed
ports/volumes must be listed under **Upgrade notes**.

### Step 4: Draft release notes

```markdown
**Release date:** YYYY-MM-DD
**Docker image:** `lostiboy7/pfadi-app:vX.Y.Z` (also `:latest`)

## Upgrade notes
- None / [new env vars, camps.json changes, compose changes]

## New features
- Description (#PR)

## Bug fixes
- Description (#PR)

## Dependency updates
- Renovate: <package> → <version> (#PR)   # latest version only, deduplicated
```

Write the notes in German if the user writes German commit messages (the repo
does). Show the draft to the user and wait for approval.

### Step 5: Make sure main is green

```bash
GH_PAGER="" gh run list --workflow docker.yml --branch main --limit 1
```

The last `develop` build must be `success`; otherwise the release build will
very likely fail too.

### Step 6: Create the release (after user approval)

```bash
GH_PAGER="" gh release create vX.Y.Z --target main \
  --title "Release X.Y.Z" --notes-file <notes.md>
```

Add `--prerelease` for release candidates (`vX.Y.Z-rc.1`) — they get their own
Docker tag but do not move `:latest`.

### Step 7: Verify the image was published

```bash
RUN=$(GH_PAGER="" gh run list --workflow docker.yml --event release --limit 1 --json databaseId -q '.[0].databaseId')
gh run watch "$RUN" --exit-status
docker manifest inspect lostiboy7/pfadi-app:vX.Y.Z >/dev/null && echo "tag published"
```

Report the release URL and the run result. Never claim the image is published
without the successful run.

## Rules

1. Always use `GH_PAGER=""`.
2. Never delete or re-point an existing tag/release — make a new patch release instead.
3. Never publish without the user approving version and notes.
