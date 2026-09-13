# Hana Global Market

This repository publishes the reviewed global Hana App market index. It does
not run submitted code or build submitted projects. The generated
`index.v2.json` only points Hana clients at ZIP files that were checked against
the matching entry metadata and GitHub Release asset.

## Enroll an App release

1. Upload both the packer-produced `.entry.json` and its matching `.zip` to a
   stable GitHub Release in that repository. The release must be neither a
   draft nor a prerelease.
2. Make a pull request that adds one record to `registry.json`. A record
   contains the extension kind, safe id, `owner/repository`, and publisher
   name. Maintainers review the enrollment before merging it.
3. The market workflow reads the latest stable release and atomically updates
   the index only when every enrolled release validates.

For apps, connectors, roles, and bundles the entry asset is named
`<kind>-<id>-<version>.entry.json`. Skills and recipes use
`<kind>-<id>.entry.json` and content-addressed ZIP files. Build both files with
Hana's `extension-pack` command before uploading them.

If a repository has multiple independent release tracks, its publisher must
make the release selected by GitHub's “latest release” appropriate for this
market. This repository does not infer a track across repositories.

The sync batch fails without changing the published index if any enrollment is
invalid, unavailable, downgraded, or has mismatched release assets. Fix the
reported enrollment or release, then rerun the workflow.

New stable releases are discovered hourly after enrollment. A main-branch
change or a manual Actions run can also start synchronization. Discovery never
installs updates automatically in Hana. The mainland China catalog is reviewed
and hosted independently; this repository publishes only the Global catalog.

## Local checks

Use Node.js 24.15.0 or a compatible Node 24 release. The synchronizer is bundled
with its dependencies; no npm install or Hana checkout is required here.

```bash
# Validate the complete candidate catalog without changing any files.
node scripts/extension-market-sync.mjs --registry registry.json --previous index.v2.json --out index.v2.json --check

# Generate the next index locally after every enrolled release validates.
node scripts/extension-market-sync.mjs --registry registry.json --previous index.v2.json --out index.v2.json
```

An optional read-only `GITHUB_TOKEN` raises the GitHub API rate limit. It is
sent only to api.github.com, never to installation-package hosts or redirects.
Do not commit tokens. The initial registry is empty; submitting a valid
enrollment is what makes the first App discoverable.

## Review and publication

Only maintainers merge enrollment PRs. `.github/CODEOWNERS` requests their
review for registry and maintenance code changes; the file alone does not
enforce approval. Contributor validation executes the base branch's bundled
tool against the proposed registry, without executing code from the PR.

The generation job has read-only repository access. A separate publisher job
receives the generated index and has `contents: write`; that GitHub permission
is repository-wide, while the trusted workflow stages only `index.v2.json`.
It fails if main changed during generation and never force-pushes.

If enabling rules that require all changes to go through a PR, configure an
approved publisher/bypass compatible with unattended index updates first;
the default GitHub Actions token cannot be assumed to bypass protected-branch
requirements. Do not grant write access to the generation or PR jobs.

The included Apache-2.0 license covers these catalog tools. Individual Apps
retain the licenses declared by their authors. `market-export.json` identifies
the Hana version used to export the bundled tool; re-export from Hana to update
the tool and review the resulting changes.
