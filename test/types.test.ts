import { P, isMatching, match } from 'ts-pattern'
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

  it('infers the supplied pattern for both bind and ref', () => {
    const { bind, ref } = binding(P.string)
    const input: unknown = {
      order: { customer: { id: 'customer-123' } },
      payment: { customer: { id: 'customer-123' } }
    }

    expectTypeOf(isMatching(bind)).guards.toBeString()
    expectTypeOf(isMatching(ref)).guards.toBeString()

    match(input)
      .with(
        {
          order: { customer: { id: bind } },
          payment: { customer: { id: ref } }
        },
        ({
          order: {
            customer: { id: orderId }
          },
          payment: {
            customer: { id: paymentId }
          }
        }) => {
          expectTypeOf(orderId).toBeString()
          expectTypeOf(paymentId).toBeString()

          return paymentId.toUpperCase()
        }
      )
      .otherwise(() => undefined)
  })

  it('infers constructor patterns and requires a pattern for narrowed types', () => {
    const { bind, ref } = new Binding(P.string)

    expectTypeOf(isMatching(bind)).guards.toBeString()
    expectTypeOf(isMatching(ref)).guards.toBeString()
    expectTypeOf(
      Binding<unknown, typeof P.string>
    ).constructorParameters.toEqualTypeOf<[pattern: typeof P.string]>()
  })

  it('infers literal, undefined, union, object, and array patterns', () => {
    const { ref: literalRef } = binding('customer-123')
    const { ref: undefinedRef } = binding(undefined)
    const { ref: unionRef } = binding(P.union(P.string, P.number))
    const { ref: objectRef } = binding({ id: P.string })
    const { ref: arrayRef } = binding(P.array(P.string))

    expectTypeOf(isMatching(literalRef)).guards.toEqualTypeOf<'customer-123'>()
    expectTypeOf(isMatching(undefinedRef)).guards.toBeUndefined()
    expectTypeOf(isMatching(unionRef)).guards.toEqualTypeOf<string | number>()
    expectTypeOf(isMatching(objectRef)).guards.toEqualTypeOf<{ id: string }>()
    expectTypeOf(isMatching(arrayRef)).guards.toEqualTypeOf<string[]>()
  })

  it('preserves unknown when no pattern or a wildcard pattern is supplied', () => {
    const { bind, ref } = binding()
    const { ref: wildcardRef } = binding(P._)

    expectTypeOf(isMatching(bind)).guards.toBeUnknown()
    expectTypeOf(isMatching(ref)).guards.toBeUnknown()
    expectTypeOf(isMatching(wildcardRef)).guards.toBeUnknown()
  })

  it('narrows a selection around a constrained reference', () => {
    const { bind, ref } = binding(P.string)
    const input: unknown = { first: 'same', second: 'same' }

    match(input)
      .with(
        { first: bind, second: P.select('customerId', ref) },
        ({ customerId }) => {
          expectTypeOf(customerId).toBeString()

          return customerId.toUpperCase()
        }
      )
      .otherwise(() => undefined)
  })

  it('keeps constrained equality branches non-exhaustive', () => {
    const { bind, ref } = binding(P.string)
    const input: { first: string; second: string } = {
      first: 'same',
      second: 'same'
    }
    const result = match(input).with(
      { first: bind, second: ref },
      () => 'equal'
    )

    expectTypeOf(result.exhaustive).not.toBeFunction()
    expectTypeOf(result.otherwise(() => 'different')).toBeString()
    expectTypeOf(
      match<string>('same').with(ref, (value) => value).exhaustive
    ).not.toBeFunction()
  })

  it('keeps a partial bind pattern non-exhaustive', () => {
    const { bind } = binding(P.string.regex(/^customer-/))
    const result = match<string>('different').with(bind, (value) => value)

    expectTypeOf(result.exhaustive).not.toBeFunction()
    expectTypeOf(result.otherwise(() => 'fallback')).toBeString()
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

describe('inline pattern types', () => {
  it('narrows both positions and passes the inferred Binding to the callback', () => {
    const pattern = binding(P.string, (current) => {
      expectTypeOf(current).toEqualTypeOf<Binding<string, typeof P.string>>()

      const { bind, ref } = current

      return { first: bind, second: ref }
    })

    match<unknown>({ first: 'same', second: 'same' })
      .with(pattern, ({ first, second }) => {
        expectTypeOf(first).toBeString()
        expectTypeOf(second).toBeString()

        return second.toUpperCase()
      })
      .otherwise(() => undefined)
  })

  it('preserves unknown without a supplied pattern', () => {
    const pattern = binding((current) => {
      expectTypeOf(current).toEqualTypeOf<Binding>()

      const { bind, ref } = current

      return [bind, ref]
    })

    expectTypeOf(isMatching(pattern)).guards.toEqualTypeOf<[unknown, unknown]>()
  })

  it('infers literal, undefined, union, object, and array constraints', () => {
    const literal = binding('customer-123', ({ bind, ref }) => [bind, ref])
    const undefinedPattern = binding(undefined, ({ bind, ref }) => [bind, ref])
    const union = binding(P.union(P.string, P.number), ({ bind, ref }) => [
      bind,
      ref
    ])
    const object = binding({ id: P.string }, ({ bind, ref }) => [bind, ref])
    const array = binding(P.array(P.string), ({ bind, ref }) => [bind, ref])

    expectTypeOf(isMatching(literal)).guards.toEqualTypeOf<
      ['customer-123', 'customer-123']
    >()
    expectTypeOf(isMatching(undefinedPattern)).guards.toEqualTypeOf<
      [undefined, undefined]
    >()
    expectTypeOf(isMatching(union)).guards.toEqualTypeOf<
      [string | number, string | number]
    >()
    const [objectBind, objectRef] = object

    expectTypeOf(isMatching(objectBind)).guards.toEqualTypeOf<{ id: string }>()
    expectTypeOf(isMatching(objectRef)).guards.toEqualTypeOf<{ id: string }>()
    expectTypeOf(isMatching(array)).guards.toEqualTypeOf<[string[], string[]]>()
  })

  it('preserves the original input and callback pattern literals', () => {
    type Input = {
      readonly first: { readonly id: string; readonly extra: number }
      readonly second: { readonly id: string }
      readonly status: 'ready' | 'pending'
    }
    const input: Input = {
      first: { id: 'same', extra: 42 },
      second: { id: 'same' },
      status: 'ready'
    }

    match(input)
      .with(
        binding(P.string, ({ bind, ref }) => ({
          first: { id: bind },
          second: { id: ref },
          status: 'ready'
        })),
        ({ first: { extra }, status }) => {
          expectTypeOf(extra).toBeNumber()
          expectTypeOf(status).toEqualTypeOf<'ready'>()

          return extra
        }
      )
      .otherwise(() => undefined)
  })

  it('preserves named, anonymous, and array selection types', () => {
    match<unknown>({ first: 'same', second: 'same' })
      .with(
        binding(P.string, ({ bind, ref }) => ({
          first: bind,
          second: P.select('id', ref)
        })),
        (selection) => {
          expectTypeOf(selection).toEqualTypeOf<{ id: string }>()

          return selection
        }
      )
      .otherwise(() => undefined)
    match<unknown>(['same', 'same'])
      .with(
        binding(P.string, ({ bind, ref }) => [P.select(bind), ref]),
        (selection) => {
          expectTypeOf(selection).toBeString()

          return selection
        }
      )
      .otherwise(() => undefined)
    match<unknown>([])
      .with(
        P.array(
          binding(P.string, ({ bind, ref }) => [P.select('id', bind), ref])
        ),
        (selection) => {
          expectTypeOf(selection).toEqualTypeOf<{ id: string[] }>()

          return selection
        }
      )
      .otherwise(() => undefined)
  })

  it('infers independent constraints through nested callbacks', () => {
    const pattern = binding(P.string, ({ bind: bindName, ref: sameName }) =>
      binding(P.number, ({ bind: bindId, ref: sameId }) => [
        bindName,
        bindId,
        sameName,
        sameId
      ])
    )

    expectTypeOf(isMatching(pattern)).guards.toEqualTypeOf<
      [string, number, string, number]
    >()
  })

  it('keeps equality and partial guard branches non-exhaustive', () => {
    const equality = match<{ first: string; second: string }>({
      first: 'same',
      second: 'same'
    }).with(
      binding(P.string, ({ bind, ref }) => ({ first: bind, second: ref })),
      () => true
    )
    const partial = match<string>('different').with(
      binding(P.string.regex(/^customer-/), ({ bind }) => bind),
      () => true
    )

    expectTypeOf(equality.exhaustive).not.toBeFunction()
    expectTypeOf(partial.exhaustive).not.toBeFunction()
  })
})
