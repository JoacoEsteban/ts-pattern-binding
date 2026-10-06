# ts-pattern-binding

Bind a value at one position in a [ts-pattern](https://github.com/gvergnaud/ts-pattern) pattern.
Require the same value at later positions.

For example, an order and its payment must have the same customer ID:

```ts
import { P, match } from 'ts-pattern'
import { binding } from 'ts-pattern-binding'

const order = { customer: { id: 'customer-123' } }
const payment = { customer: { id: 'customer-123' } }
const { bind, ref } = binding(P.string)

const result = match({ order, payment })
  .with(
    {
      order: { customer: { id: bind } },
      payment: { customer: { id: ref } }
    },
    () => true
  )
  .otherwise(() => false)
```

`result` is `true`.
If the payment's customer ID is `'customer-456'`, the result is `false`.

`bind` requires `order.customer.id` to be a string and stores it.
`ref` requires `payment.customer.id` to equal that stored string, using `Object.is`.
Both fields belong to one pattern passed to `.with`.
`bind` and `ref` are pattern values, so neither needs `()`.

The pattern argument is optional.
`binding(P.string)` narrows both positions to `string`, including refs in the handler.
`binding()` accepts any value and leaves unknown inputs as `unknown`.

Place `bind` before `ref` in the pattern.
Create a fresh binding for each match operation.
The [state lifetime rules](#evaluation-order-and-state-lifetime) explain reuse and more complex patterns.

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
order = %{customer: %{id: "customer-123"}}
payment = %{customer: %{id: "customer-123"}}

case %{order: order, payment: payment} do
  %{order: %{customer: %{id: customer_id}}, payment: %{customer: %{id: customer_id}}} -> true
  _ -> false
end
```

Elixir also supports the pin operator, `^`, for a value that exists before the pattern.
This library implements the repeated-variable use case with explicit `bind` and `ref` positions.
The [Elixir pattern documentation](https://hexdocs.pm/elixir/patterns-and-guards.html#variables) describes both forms.

### Why ts-pattern does not provide this directly

ts-pattern accepts patterns made from JavaScript values and matcher objects.
JavaScript evaluates a variable before ts-pattern receives the pattern.
Repeated JavaScript references therefore represent existing values, rather than variables that ts-pattern can bind during a match.

`P.select('customerId')` passes a value to the handler.
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

const order = { customer: { id: 'customer-123' } }
const payment = { customer: { id: 'customer-123' } }

const result = match({ order, payment })
  .with(
    {
      order: { customer: { id: P.string } },
      payment: { customer: { id: P.string } }
    },
    ({
      order: {
        customer: { id: orderCustomerId }
      },
      payment: {
        customer: { id: paymentCustomerId }
      }
    }) => Object.is(orderCustomerId, paymentCustomerId),
    () => true
  )
  .otherwise(() => false)
```

`binding` places each equality constraint beside the field that it concerns.
This form is useful for nested patterns and several independent constraints.

## API

### `binding(pattern?)`

Each call creates an independent binding.
The returned instance contains stable, readonly `bind` and `ref` patterns.
An optional ts-pattern pattern constrains both positions and supplies their inferred type.
Without a pattern, `bind` accepts any value and `ref` only requires equality.

```ts
import { isMatching } from 'ts-pattern'
import { binding } from 'ts-pattern-binding'

const { bind, ref } = binding()

const allEqual = isMatching([bind, ref, ref], [42, 42, 42])
```

`allEqual` is `true`.
If the last value is `43`, the pattern fails.
The first position stores `42`.
Both references must match that value.
Each successful visit to `bind` replaces the stored value.
A value that fails the supplied pattern leaves the previous binding unchanged.
`ref` never changes the stored value.

### `new Binding(pattern?)`

The class constructor is equivalent to the factory.
Instances support `instanceof Binding`.
`new Binding(P.string)` infers string patterns.
`new Binding()` leaves unknown inputs as `unknown`.

### `reset(): void`

`reset` clears the stored value.
Every reference then fails until the next bind.
The existing pattern objects remain valid.

```ts
import { isMatching } from 'ts-pattern'
import { binding } from 'ts-pattern-binding'

const customerId = binding()
const { bind, ref } = customerId

isMatching(bind, 'customer-123')
const beforeReset = isMatching(ref, 'customer-123')
customerId.reset()
const afterReset = isMatching(ref, 'customer-123')
```

`beforeReset` is `true`.
`afterReset` is `false`, even though the customer ID is unchanged.
The state distinguishes an unbound value from a bound `undefined`.
Before a reset, `ref` can match a bound `undefined`.

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

## Selections

`P.select` passes the matching customer ID to the handler:

```ts
import { P, match } from 'ts-pattern'
import { binding } from 'ts-pattern-binding'

const order = { customer: { id: 'customer-123' } }
const payment = { customer: { id: 'customer-123' } }
const { bind, ref } = binding(P.string)

const result = match({ order, payment })
  .with(
    {
      order: { customer: { id: P.select('customerId', bind) } },
      payment: { customer: { id: ref } }
    },
    ({ customerId }) => customerId
  )
  .otherwise(() => 'Customer IDs differ')
```

`result` is `'customer-123'`.
`P.select('customerId', bind)` stores the value and selects it for the handler.
`ref` requires the payment's customer ID to match that value.

## Types and runtime guards

The supplied pattern determines the runtime constraint and the inferred types of both matchers.
Strings, literals, unions, arrays, and object patterns retain the types that ts-pattern infers.
`ref` checks the pattern again after equality succeeds.
This checks the current shape of a retained object if its contents change.

For unknown inputs, pass the runtime pattern to `binding`:

```ts
import { P, match } from 'ts-pattern'
import { binding } from 'ts-pattern-binding'

const { bind, ref } = binding(P.string)
const input: unknown = {
  order: { customer: { id: 'customer-123' } },
  payment: { customer: { id: 'customer-123' } }
}

const result = match(input)
  .with(
    {
      order: { customer: { id: bind } },
      payment: { customer: { id: ref } }
    },
    ({
      payment: {
        customer: { id }
      }
    }) => id.toUpperCase()
  )
  .otherwise(() => 'Invalid or different customer IDs')
```

`result` is `'CUSTOMER-123'`.
Both customer IDs have type `string` in the handler.
The handler uses the payment's ID, which matched `ref`.
Equal numbers fail the supplied string pattern.

Without a pattern, both matchers leave unknown values as `unknown`.
The existing `binding<T>()` and `new Binding<T>()` forms still record an intended input type without runtime validation.
For example, `binding<string>()` accepts equal numbers and does not narrow unknown inputs to strings.
A separate `P.intersection(P.string, bind)` guard does not change a reference's inferred type.

`binding(undefined)` requires a literal `undefined` value.
Omitting the argument with `binding()` accepts any value.
Selections inside a supplied pattern do not pass values to the handler.
Use `P.select` around `bind` or `ref` to select a value.

An equality-dependent branch does not make a match exhaustive.
It still needs a fallback or other branches that cover the remaining inputs.
`bind` also requires a fallback because a supplied pattern can accept only part of its inferred type.

`BindingPattern<T, Narrowed>` and `ReferencePattern<T, Narrowed>` are exported for explicit annotations.
`Narrowed` defaults to `unknown`.

## Evaluation order and state lifetime

These patterns contain mutable state.
Each reference must run after its bind.
ts-pattern visits object keys in the pattern's enumeration order and tuple positions from left to right.
Numeric object keys run in numeric order, even after a different insertion order.
The [ts-pattern matcher implementation](https://github.com/gvergnaud/ts-pattern/blob/v5.9.0/src/internals/helpers.ts) determines this traversal.

For ordinary object keys, place the bind before the references:

```ts
import { P, isMatching } from 'ts-pattern'
import { binding } from 'ts-pattern-binding'

const order = { customer: { id: 'customer-123' } }
const payment = { customer: { id: 'customer-123' } }
const { bind, ref } = binding(P.string)

const result = isMatching(
  {
    order: { customer: { id: bind } },
    payment: { customer: { id: ref } }
  },
  { order, payment }
)
```

`result` is `true`.
A fresh binding fails if the pattern visits `payment.customer.id` before `order.customer.id`.
Input property order does not change pattern order.

Create a fresh binding inside each match operation.
If a function performs the match, create the binding inside the function.

The matcher API does not notify these patterns when an enclosing branch fails or a match finishes.
A failed property, reference, or guard does not undo a previous bind.
State remains until another bind or `reset`.
Each binding therefore needs its own lifetime.

- Use separate bindings for separate `.with` branches and union alternatives.
- Place one bind before its references on every evaluation path.
- If a pattern repeats in `P.array`, make sure that each element visits its bind before its references.
- Avoid `bind` or `ref` inside `P.not`.
- Avoid `bind` inside an optional pattern that can skip it.
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
