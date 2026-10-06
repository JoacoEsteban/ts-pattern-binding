import { P, match } from 'ts-pattern'
import { describe, expectTypeOf, it } from 'vitest'

import { Binding, binding } from '../src/index.js'
import type { BindingPattern, ReferencePattern } from '../src/index.js'

describe('public types', () => {
  it('defaults to unknown and supports explicit input types', () => {
    expectTypeOf(binding()).toEqualTypeOf<Binding>()
    expectTypeOf(binding<string>()).toEqualTypeOf<Binding<string>>()
    expectTypeOf(new Binding<undefined>()).toEqualTypeOf<Binding<undefined>>()
    expectTypeOf<Binding<string>['bind']>().toEqualTypeOf<
      BindingPattern<string>
    >()
    expectTypeOf<Binding<string>['ref']>().toEqualTypeOf<
      ReferencePattern<string>
    >()
  })

  it('preserves the original nested input in a handler', () => {
    type Input = {
      readonly a: { readonly current: string; readonly id: number }
      readonly b: { readonly current: string; readonly active: boolean }
    }

    const { bind, ref } = binding<string>()
    const input: Input = {
      a: { current: 'same', id: 1 },
      b: { current: 'same', active: true }
    }

    match(input)
      .with({ a: { current: bind }, b: { current: ref } }, (value) => {
        expectTypeOf(value).toEqualTypeOf<Input>()

        return value
      })
      .otherwise((value) => {
        expectTypeOf(value).toEqualTypeOf<Input>()

        return value
      })
  })

  it('does not narrow unknown inputs from a generic argument', () => {
    const { bind, ref } = binding<string>()
    const input: unknown = { first: 42, second: 42 }

    match(input)
      .with({ first: bind, second: ref }, ({ first, second }) => {
        expectTypeOf(first).toBeUnknown()
        expectTypeOf(second).toBeUnknown()

        return first
      })
      .otherwise((value) => value)
  })

  it('narrows unknown inputs only through real runtime guards', () => {
    const { bind, ref } = binding<string>()
    const input: unknown = { first: 'same', second: 'same' }

    match(input)
      .with(
        {
          first: P.intersection(P.string, bind),
          second: P.intersection(P.string, ref)
        },
        ({ first, second }) => {
          expectTypeOf(first).toBeString()
          expectTypeOf(second).toBeString()

          return first
        }
      )
      .otherwise(() => undefined)
  })

  it('does not claim exhaustiveness for equality-dependent branches', () => {
    const { bind, ref } = binding<string>()

    const result = match<{ first: string; second: string }>({
      first: 'same',
      second: 'same'
    }).with({ first: bind, second: ref }, () => 'equal')

    expectTypeOf(result.exhaustive).not.toBeFunction()
    expectTypeOf(result.otherwise(() => 'different')).toBeString()
  })

  it('preserves named selection types', () => {
    const { bind, ref } = binding<string>()

    match({ first: 'same', second: 'same' })
      .with({ first: P.select('current', bind), second: ref }, (selection) => {
        expectTypeOf(selection).toEqualTypeOf<{ current: 'same' }>()

        return selection
      })
      .otherwise(() => undefined)
  })

  it('supports readonly tuples and union input types', () => {
    const { bind, ref } = binding<string | number>()
    const input: readonly [string | number, string | number] = ['same', 'same']

    match(input)
      .with([bind, ref], ([first, second]) => {
        expectTypeOf(first).toEqualTypeOf<string | number>()
        expectTypeOf(second).toEqualTypeOf<string | number>()

        return first
      })
      .otherwise(() => undefined)
  })

  it('exposes reset without a return value', () => {
    expectTypeOf<Binding['reset']>().returns.toBeVoid()
  })

  it('preserves the wildcard pattern type', () => {
    expectTypeOf<P.infer<BindingPattern<string>>>().toBeUnknown()
  })

  it('preserves a selection around bind alone', () => {
    const { bind } = binding<string>()

    match({ first: 'same' })
      .with({ first: P.select('current', bind) }, ({ current }) => {
        expectTypeOf(current).toBeString()

        return current
      })
      .otherwise(() => undefined)
  })

  it('preserves a selection beside a reference', () => {
    const { ref } = binding<string>()

    match({ first: 'same', second: 'same' })
      .with({ first: P.select('current'), second: ref }, ({ current }) => {
        expectTypeOf(current).toBeString()

        return current
      })
      .otherwise(() => undefined)
  })
})
