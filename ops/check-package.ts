import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { P, match } from 'ts-pattern'

const root = fileURLToPath(new URL('../', import.meta.url))

const packed: unknown = JSON.parse(
  execFileSync('npm', ['pack', '--json', '--ignore-scripts'], {
    cwd: root,
    encoding: 'utf8'
  })
)

const artifact = match(packed)
  .with(
    [
      {
        filename: P.select('filename', P.string),
        files: P.select('files', P.array({ path: P.string }))
      }
    ],
    (value) => value
  )
  .otherwise(() => undefined)

assert.ok(artifact, 'npm pack must return one package artifact')

const { filename, files } = artifact
const tarball = join(root, filename)
const directory = mkdtempSync(join(tmpdir(), 'ts-pattern-binding-'))

process.once('exit', () => {
  rmSync(directory, { recursive: true, force: true })
  rmSync(tarball, { force: true })
})

for (const { path } of files) {
  assert.match(path, /^(dist\/|package\.json$|README\.md$|LICENSE$)/)
}

for (const path of [
  'dist/index.mjs',
  'dist/index.cjs',
  'dist/index.d.mts',
  'dist/index.d.cts'
]) {
  assert.ok(
    files.some(({ path: actual }) => actual === path),
    `${path} must be packed`
  )
}

writeFileSync(
  join(directory, 'package.json'),
  JSON.stringify({ private: true, type: 'module' })
)

execFileSync(
  'npm',
  [
    'install',
    '--ignore-scripts',
    '--no-audit',
    '--no-fund',
    '--package-lock=false',
    tarball
  ],
  { cwd: directory, stdio: 'pipe' }
)

const smoke = `
import assert from 'node:assert/strict'
import { Binding, binding } from 'ts-pattern-binding'
import { P, isMatching, match } from 'ts-pattern'

const current = binding()
const { bind, ref } = current
assert.ok(current instanceof Binding)
assert.equal(isMatching(ref, undefined), false)
assert.equal(isMatching([bind, ref], [undefined, undefined]), true)
assert.equal(isMatching([bind, ref], [NaN, NaN]), true)
assert.equal(isMatching([bind, ref], [0, -0]), false)
assert.equal(isMatching([bind, ref], [{ id: 1 }, { id: 1 }]), false)
assert.equal(match({ a: 'same', b: 'same' })
  .with({ a: P.select(bind), b: ref }, (value) => value)
  .otherwise(() => 'different'), 'same')
current.reset()
assert.equal(isMatching(ref, 'same'), false)
`

writeFileSync(join(directory, 'smoke.mjs'), smoke)
writeFileSync(
  join(directory, 'smoke.cjs'),
  smoke
    .replace(
      "import assert from 'node:assert/strict'",
      "const assert = require('node:assert/strict')"
    )
    .replace(
      "import { Binding, binding } from 'ts-pattern-binding'",
      "const { Binding, binding } = require('ts-pattern-binding')"
    )
    .replace(
      "import { P, isMatching, match } from 'ts-pattern'",
      "const { P, isMatching, match } = require('ts-pattern')"
    )
)

for (const file of ['smoke.mjs', 'smoke.cjs']) {
  execFileSync(process.execPath, [file], { cwd: directory, stdio: 'inherit' })
}

const consumer = `
import { Binding, binding } from 'ts-pattern-binding'
import { match } from 'ts-pattern'

const current: Binding<string> = binding<string>()
const { bind, ref } = current
const result: string = match({ a: 'same', b: 'same' })
  .with({ a: bind, b: ref }, ({ a }) => a)
  .otherwise(() => 'different')
current.reset()
console.log(result)
`

for (const file of ['consumer.mts', 'consumer.cts']) {
  writeFileSync(join(directory, file), consumer)
}

execFileSync(
  process.execPath,
  [
    join(root, 'node_modules/typescript/bin/tsc'),
    '--noEmit',
    '--strict',
    '--noUncheckedIndexedAccess',
    '--exactOptionalPropertyTypes',
    '--module',
    'NodeNext',
    '--moduleResolution',
    'NodeNext',
    '--target',
    'ES2022',
    'consumer.mts',
    'consumer.cts'
  ],
  { cwd: directory, stdio: 'inherit' }
)

assert.ok(
  readFileSync(join(root, 'README.md'), 'utf8').includes('ts-pattern-binding')
)
console.log('Packed files, ESM, CommonJS, and consumer declarations passed')
