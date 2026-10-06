import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { appendFileSync, readFileSync } from 'node:fs'
import process from 'node:process'
import { P, match } from 'ts-pattern'

const metadata: unknown = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8')
)

const identity = match(metadata)
  .with(
    {
      name: P.select('name', P.string),
      version: P.select('version', P.string)
    },
    (value) => value
  )
  .otherwise(() => undefined)

assert.ok(identity, 'package.json must contain a name and version')

const { name, version } = identity
const { GITHUB_OUTPUT: output } = process.env
const tarball = `${name}-${version}.tgz`
const prerelease = match(version)
  .with(P.string.regex(/-/), () => true)
  .otherwise(() => false)

const distTag = match(prerelease)
  .with(true, () => 'next')
  .with(false, () => 'latest')
  .exhaustive()

assert.ok(output, 'GITHUB_OUTPUT must exist')

const response = await fetch(
  `https://registry.npmjs.org/${encodeURIComponent(name)}/${encodeURIComponent(version)}`
)

const publish = await match(response.status)
  .with(404, () => true)
  .with(200, async () => {
    const published: unknown = await response.json()

    const integrity = match(published)
      .with({ dist: { integrity: P.select(P.string) } }, (value) => value)
      .otherwise(() => undefined)

    const actual = `sha512-${createHash('sha512').update(readFileSync(tarball)).digest('base64')}`

    assert.equal(
      integrity,
      actual,
      'The existing npm version must contain the same artifact'
    )
    console.log(`${name}@${version} already contains the checked artifact`)

    return false
  })
  .otherwise((status) =>
    assert.fail(`npm registry returned HTTP ${String(status)}`)
  )

appendFileSync(
  output,
  `publish=${String(publish)}\ntarball=${tarball}\ndist_tag=${distTag}\nprerelease=${String(prerelease)}\n`
)
