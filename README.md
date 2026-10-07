# Hana Global Market

This repository publishes the reviewed global Hana App market index. It does
not run submitted code or build submitted projects. The generated
`index.v2.json` only points Hana clients at ZIP files whose release tag and
SHA-256 a maintainer approved in `approvals.json`. Clients verify every
download against that SHA-256, so a changed or deleted Release asset makes
installation fail instead of installing different bytes.

## Contributing / 投稿

See [CONTRIBUTING.md](CONTRIBUTING.md) for the Chinese and English submission
guide: packaging, stable Releases, enrollment PRs, review, updates, and troubleshooting.

投稿前请阅读[中英双语贡献指南](CONTRIBUTING.md)。本仓库收录发布登记，不接收安装包或扩展源码的直接上传。

## Enroll an App release

1. Upload both the packer-produced `.entry.json` and its matching `.zip` to a
   stable GitHub Release in that repository. The release must be neither a
   draft nor a prerelease.
2. Make a pull request that adds one record to `registry.json`. A record
   contains the extension kind, safe id, `owner/repository`, and publisher
   name. Maintainers review the enrollment before merging it.
3. A maintainer approves the reviewed package by recording its release tag and
   ZIP SHA-256 in `approvals.json`. The market workflow publishes only approved
   packages and atomically updates the index when every changed approval
   validates. Enrollments without an approval are not listed.

For apps, connectors, roles, and bundles the entry asset is named
`<kind>-<id>-<version>.entry.json`. Skills and recipes use
`<kind>-<id>.entry.json` and content-addressed ZIP files. Build both files with
Hana's `extension-pack` command before uploading them.

If a repository has multiple independent release tracks, its publisher must
make the release selected by GitHub's “latest release” appropriate for this
market. This repository does not infer a track across repositories.

The sync batch fails without changing the published index if any enrollment
or approval is invalid, or a newly approved release is unavailable,
downgraded, or does not match its approved SHA-256. Published entries whose
approval did not change are reused without downloading them again. Fix the
reported enrollment, approval, or release, then rerun the workflow.

New stable releases are discovered hourly. Discovery never changes the index:
for each unapproved package it opens one approval pull request with the tag,
version, SHA-256, size, permission changes, and a source comparison link.
Merging that pull request publishes the update; closing it rejects those
bytes. Discovery never installs updates automatically in Hana. The mainland
China catalog is reviewed and hosted independently; this repository publishes
only the Global catalog.

## Local checks

Use Node.js 24.15.0 or a compatible Node 24 release. The synchronizer is bundled
with its dependencies; no npm install or Hana checkout is required here.

```bash
# Validate the registry, approvals, and changed approved releases without changing any files.
node scripts/extension-market-sync.mjs --registry registry.json --approvals approvals.json --previous index.v2.json --out index.v2.json --check

# List unapproved latest stable releases with the tag and SHA-256 to review.
node scripts/extension-market-sync.mjs --discover --registry registry.json --approvals approvals.json --previous index.v2.json --out proposals.json

# Pin one reviewed proposal (a single object from proposals.json) into approvals.json.
node scripts/extension-market-sync.mjs --apply-proposal proposal.json --approvals approvals.json

# Generate the next index locally from approved releases.
node scripts/extension-market-sync.mjs --registry registry.json --approvals approvals.json --previous index.v2.json --out index.v2.json
```

An optional read-only `GITHUB_TOKEN` raises the GitHub API rate limit. It is
sent only to api.github.com, never to installation-package hosts or redirects.
Do not commit tokens. The initial registry is empty; submitting a valid
enrollment is what makes the first App discoverable.

## Review and publication

Only maintainers merge enrollment and approval PRs. `.github/CODEOWNERS`
requests their review for registry, approvals, and maintenance code changes;
the file alone does not enforce approval. Contributor validation executes the
base branch's bundled tool against the proposed registry and approvals,
without executing code from the PR, and prints the release an enrollment
review would approve.

The generation job has read-only repository access. A separate publisher job
receives the generated index and has `contents: write`; that GitHub permission
is repository-wide, while the trusted workflow stages only `index.v2.json`.
It fails if main changed during generation and never force-pushes.

The discovery job runs only trusted main code. It has `contents: write` and
`pull-requests: write` to push one `market-approval/*` branch per package and
open its pull request. The repository must allow GitHub Actions to create pull
requests. Pull requests opened with the Actions token do not trigger other
workflows; discovery has already verified the package bytes before opening it.

If enabling rules that require all changes to go through a PR, configure an
approved publisher/bypass compatible with unattended index updates first;
the default GitHub Actions token cannot be assumed to bypass protected-branch
requirements. Do not grant write access to the generation or PR jobs.

The included Apache-2.0 license covers these catalog tools. Individual Apps
retain the licenses declared by their authors. `market-export.json` identifies
the Hana version used to export the bundled tool; re-export from Hana to update
the tool and review the resulting changes.
