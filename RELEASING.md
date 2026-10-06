# Releases

`release.yml` runs when a `v*` tag reaches GitHub.
The workflow checks the package, compares the tag with `package.json`, and creates a GitHub release with the npm tarball.
Its publish job uses npm trusted publishing through GitHub Actions OIDC.
It does not need a stored npm token.

## First publication

The first package version needs an authenticated npm account.
The package must exist before its settings can contain a trusted publisher.

1. Authenticate with `npm login`.
2. Run `mise run check`.
3. Run `npm publish --access public`.
4. Push the `v0.1.0` tag to GitHub.

The workflow compares an existing npm version's integrity with its own tarball.
If they match, it skips the duplicate publication.
If they differ, the workflow fails.
This permits the initial tag after the manual first publication.

## Trusted publisher

Before the first release through OIDC, open [the package settings](https://www.npmjs.com/package/ts-pattern-binding/access).
Add a trusted publisher with these values:

| Field                | Value                                |
| -------------------- | ------------------------------------ |
| Provider             | GitHub Actions                       |
| Organization or user | `JoacoEsteban`                       |
| Repository           | `ts-pattern-binding`                 |
| Workflow filename    | `release.yml`                        |
| Environment          | `npm`                                |
| Allowed actions      | Direct publishing with `npm publish` |

The [npm trusted-publisher documentation](https://docs.npmjs.com/trusted-publishers/) describes the required fields and OIDC permissions.
New publisher configurations expire after two days without a successful publication.
An integrity check that skips a duplicate publication does not activate the publisher.
The first manual publication does not contain GitHub provenance.
Future publications from this public repository receive provenance through OIDC.

## Later releases

1. Update the version in `package.json` and `package-lock.json`.
2. Add the release notes to `CHANGELOG.md`.
3. Run `mise run check`.
4. Push the changes to `main`.
5. Push a tag named `v<version>` for that revision.

For example, package version `0.2.0` needs tag `v0.2.0`.
`mise run release:check -- v0.2.0` checks this relationship locally.

The workflow rejects a tag that differs from the package version.
Stable versions use the npm `latest` tag.
Versions with a prerelease suffix use the npm `next` tag and a GitHub prerelease.
GitHub releases include notes from `CHANGELOG.md` and the checked tarball.

If publication fails, rerun the failed workflow after the authentication or configuration error is resolved.
The integrity comparison prevents an identical version from publishing twice.
