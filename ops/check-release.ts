import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import process from 'node:process'
import { P, match } from 'ts-pattern'

const metadata: unknown = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8')
)

const version = match(metadata)
  .with({ version: P.select(P.string) }, (value) => value)
  .otherwise(() => undefined)

const [, , tag] = process.argv

assert.ok(version, 'package.json must contain a version')
assert.equal(tag, `v${version}`, 'The release tag must match package.json')
console.log(`Release tag ${tag} matches package version ${version}`)
