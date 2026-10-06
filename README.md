# ts-pattern-binding

Bind a value at one position in a [ts-pattern](https://github.com/gvergnaud/ts-pattern) pattern.
Require the same value at later positions.

```ts
import { match } from 'ts-pattern'
import { binding } from 'ts-pattern-binding'

const current = binding<string>()

const result = match({
  a: { current: 'same' },
  b: { current: 'same' }
})
  .with(
    {
      a: { current: current.bind },
      b: { current: current.ref }
    },
    () => 'same'
  )
  .otherwise(() => 'different')
```

`bind` stores the value and always matches.
`ref` matches only after a bind, and only when `Object.is` returns `true`.
Several references can compare against one bind.

## Install

```sh
npm install ts-pattern-binding ts-pattern
```

The package supports ts-pattern 5.9.x, ESM, and CommonJS.
It includes TypeScript declarations for both module formats.
ts-pattern is a peer dependency and stays outside the build.

## Why this library exists

Elixir supports repeated variables within one pattern.
Each occurrence must match the same value:

```elixir
case %{a: %{current: "same"}, b: %{current: "same"}} do
  %{a: %{current: current}, b: %{current: current}} -> :same
  _ -> :different
end
```

Elixir also supports the pin operator, `^`, for a value that exists before the pattern.
This library implements the repeated-variable use case with explicit `bind` and `ref` positions.
The [Elixir pattern documentation](https://hexdocs.pm/elixir/patterns-and-guards.html#variables) describes both forms.

### Why ts-pattern does not provide this directly

ts-pattern accepts patterns made from JavaScript values and matcher objects.
JavaScript evaluates a variable before ts-pattern receives the pattern.
Repeated JavaScript references therefore represent existing values, rather than variables that ts-pattern can bind during a match.

`P.select('current')` passes a value to the handler.
It does not impose an equality constraint on another position with the same selection name.
`P.when` receives the value at its own position.
It does not receive sibling values or a shared variable environment.
These APIs appear in the [ts-pattern documentation](https://github.com/gvergnaud/ts-pattern#patterns).

The library adds a shared state cell behind two `P.when` patterns.
One pattern writes the value.
The other pattern compares its value against that cell.
The implementation uses the public API and does not import ts-pattern internals.

ts-pattern can already express the same condition with a guard on the whole input:

```ts
import { P, match } from 'ts-pattern'

const result = match({
  a: { current: 'same' },
  b: { current: 'same' }
})
  .with(
    { a: { current: P.string }, b: { current: P.string } },
    ({ a: { current: first }, b: { current: second } }) =>
      Object.is(first, second),
    () => 'same'
  )
  .otherwise(() => 'different')
```

`binding` places each equality constraint beside the field that it concerns.
This form is useful for nested patterns and several independent constraints.

## API

### `binding<T = unknown>(): Binding<T>`

Each call creates an independent binding.
The returned instance contains stable, readonly `bind` and `ref` patterns.

```ts
import { isMatching } from 'ts-pattern'
import { binding } from 'ts-pattern-binding'

const { bind, ref } = binding<number>()

isMatching([bind, ref, ref], [42, 42, 42])
isMatching([bind, ref, ref], [42, 42, 43])
```

The first call returns `true`.
The second call returns `false`.
Each visit to `bind` replaces the stored value.
`ref` never changes the stored value.

### `new Binding<T = unknown>()`

The class constructor is equivalent to the factory.
Instances support `instanceof Binding`.

### `reset(): void`

`reset` clears the stored value.
Every reference then fails until the next bind.
The existing pattern objects remain valid.

```ts
const current = binding()
const { bind, ref } = current

isMatching([bind, ref], [undefined, undefined])
current.reset()
isMatching(ref, undefined)
```

The first match succeeds.
After the reset, the reference fails.
The state distinguishes an unbound value from a bound `undefined`.

## Equality

The library uses JavaScript's `Object.is` equality:

| Values                                       | Result   |
| -------------------------------------------- | -------- |
| Equal strings, booleans, numbers, or bigints | Match    |
| `NaN` and `NaN`                              | Match    |
| `0` and `-0`                                 | No match |
| `null` and `undefined`                       | No match |
| The same object, array, function, or symbol  | Match    |
| Separate objects with identical contents     | No match |

This choice preserves the original helper's behavior.
Elixir compares terms by value, including maps and lists.
JavaScript objects use reference identity here.

## Types and selections

`T` records the intended input type.
It does not validate a runtime value or narrow an unknown input to that type.
Handler types come from the original input and actual runtime guards.
This avoids an unchecked assertion that a value is a string because the caller wrote `binding<string>()`.

For unknown inputs, combine the patterns with runtime guards:

```ts
const { bind, ref } = binding<string>()
const input: unknown = { a: 'same', b: 'same' }

const result = match(input)
  .with(
    {
      a: P.intersection(P.string, bind),
      b: P.intersection(P.string, ref)
    },
    ({ a }) => a.toUpperCase()
  )
  .otherwise(() => 'different')
```

An equality-dependent branch does not make a match exhaustive.
It still needs a fallback or other branches that cover the remaining inputs.

`bind` also works inside a selection:

```ts
const { bind, ref } = binding<string>()

const result = match({ a: 'same', b: 'same' })
  .with({ a: P.select('current', bind), b: ref }, ({ current }) => current)
  .otherwise(() => 'different')
```

`BindingPattern<T>` and `ReferencePattern<T>` are exported for explicit annotations.

## Evaluation order and state lifetime

These patterns contain mutable state.
Each reference must run after its bind.
ts-pattern visits object keys in the pattern's enumeration order and tuple positions from left to right.
Numeric object keys run in numeric order, even after a different insertion order.
The [ts-pattern matcher implementation](https://github.com/gvergnaud/ts-pattern/blob/v5.9.0/src/internals/helpers.ts) determines this traversal.

For ordinary object keys, place the bind before the references:

```ts
const { bind, ref } = binding<string>()

isMatching({ a: bind, b: ref }, { a: 'same', b: 'same' })
```

A fresh binding fails for the reversed pattern, `{ b: ref, a: bind }`.
Input property order does not change pattern order.

Create a fresh binding inside each match operation:

```ts
const equalCurrent = (a: string, b: string): boolean => {
  const { bind, ref } = binding<string>()

  return isMatching({ a: bind, b: ref }, { a, b })
}
```

The matcher API does not notify these patterns when an enclosing branch fails or a match finishes.
A failed property, reference, or guard does not undo a previous bind.
State remains until another bind or `reset`.
Each binding therefore needs its own lifetime.

- Use separate bindings for separate `.with` branches and union alternatives.
- Place one bind before its references on every evaluation path.
- If a pattern repeats in `P.array`, make sure that each element visits its bind before its references.
- Avoid `bind` inside `P.not` or an optional pattern that can skip it.
- Avoid a shared binding across concurrent calls or nested matches.
- If you retain a binding, call `reset` before a new independent operation.

Repeated `bind` positions overwrite the value.
Use `ref` for each repeated-variable position after the first one.
These constraints distinguish this helper from Elixir's transactional pattern matching.

## Development

```sh
mise install
mise run install
mise run check
```

`mise run check` runs the compiler, type-aware linting, formatting, coverage, the build, and package checks.
The tests cover equality, nested patterns, selections, state lifetime, evaluation order, and type inference.
Property tests compare arbitrary values against `Object.is`.
Coverage must reach 100% for statements, branches, functions, and lines.

The compiler configuration includes every strict check from `chatbot-farmacias`.
It also enables `verbatimModuleSyntax` and `isolatedDeclarations`, and checks dependency declarations with `skipLibCheck: false`.
Lint rules reject `any`, unsafe operations, type assertions, non-null assertions, ternaries, and `try` statements in TypeScript.
`better-typescript-lib` replaces unsafe standard-library return types with `unknown`.

The package checks install the actual tarball in a temporary consumer.
They run ESM and CommonJS smoke tests and compile consumers for both declaration formats.
CI runs these checks on Node 22, 24, and 26.

## Releases

Release configuration and first-publication instructions are in [RELEASING.md](./RELEASING.md).

## License

MIT.
