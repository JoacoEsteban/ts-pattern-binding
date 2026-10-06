import fc from 'fast-check'
import { P, isMatching, match } from 'ts-pattern'
import { describe, expect, it } from 'vitest'

import { Binding, binding } from '../src/index.js'

describe('binding', () => {
  it('returns an independent Binding instance', () => {
    expect(binding()).toBeInstanceOf(Binding)
    expect(binding()).not.toBe(binding())
  })

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['false', false],
    ['true', true],
    ['empty string', ''],
    ['string', 'current'],
    ['zero', 0],
    ['negative zero', -0],
    ['integer', 42],
    ['negative integer', -42],
    ['fraction', 0.25],
    ['NaN', NaN],
    ['positive infinity', Infinity],
    ['negative infinity', -Infinity],
    ['bigint', 42n],
    ['symbol', Symbol('current')],
    ['object', { current: 'same' }],
    ['array', ['same']],
    ['function', () => 'same'],
    ['date', new Date(0)],
    ['map', new Map([['current', 'same']])],
    ['set', new Set(['same'])]
  ])('binds and references %s', (_, value) => {
    const { bind, ref } = binding()

    expect(isMatching([bind, ref], [value, value])).toBe(true)
  })

  it.each([
    ['different strings', 'first', 'second'],
    ['string and number', '1', 1],
    ['different numbers', 1, 2],
    ['positive and negative zero', 0, -0],
    ['negative and positive zero', -0, 0],
    ['null and undefined', null, undefined],
    ['undefined and null', undefined, null],
    ['false and zero', false, 0],
    ['true and one', true, 1],
    ['number and bigint', 1, 1n],
    ['different bigints', 1n, 2n],
    ['NaN and number', NaN, 1],
    ['distinct symbols', Symbol('same'), Symbol('same')],
    ['distinct objects', { id: 1 }, { id: 1 }],
    ['distinct arrays', [1], [1]],
    ['distinct dates', new Date(0), new Date(0)],
    ['distinct functions', () => 1, () => 1],
    ['distinct maps', new Map([['id', 1]]), new Map([['id', 1]])],
    ['distinct sets', new Set([1]), new Set([1])]
  ])('rejects %s', (_, left, right) => {
    const { bind, ref } = binding()

    expect(isMatching([bind, ref], [left, right])).toBe(false)
  })

  it.each([undefined, null, false, 0, '', NaN, {}, []])(
    'rejects an unbound reference to %s',
    (value) => {
      const { ref } = binding()

      expect(isMatching(ref, value)).toBe(false)
    }
  )

  it('accepts each new value at bind', () => {
    const { bind, ref } = binding<string>()

    expect(isMatching(bind, 'first')).toBe(true)
    expect(isMatching(ref, 'first')).toBe(true)
    expect(isMatching(bind, 'second')).toBe(true)
    expect(isMatching(ref, 'first')).toBe(false)
    expect(isMatching(ref, 'second')).toBe(true)
  })

  it('retains the binding after a failed reference', () => {
    const { bind, ref } = binding<string>()

    isMatching(bind, 'current')
    expect(isMatching(ref, 'different')).toBe(false)
    expect(isMatching(ref, 'current')).toBe(true)
    expect(isMatching(ref, 'current')).toBe(true)
  })

  it('keeps instances independent', () => {
    const first = binding<string>()
    const second = binding<string>()
    const { bind: firstBind, ref: firstRef } = first
    const { bind: secondBind, ref: secondRef } = second

    isMatching(firstBind, 'first')
    expect(isMatching(secondRef, 'first')).toBe(false)
    isMatching(secondBind, 'second')
    expect(isMatching(firstRef, 'first')).toBe(true)
    expect(isMatching(firstRef, 'second')).toBe(false)
    expect(isMatching(secondRef, 'second')).toBe(true)
  })

  it('resets an undefined binding', () => {
    const current = binding()
    const { bind, ref } = current

    isMatching(bind, undefined)
    expect(isMatching(ref, undefined)).toBe(true)
    current.reset()
    expect(isMatching(ref, undefined)).toBe(false)
  })

  it('resets repeatedly and permits another bind', () => {
    const current = new Binding<string>()
    const { bind, ref } = current

    current.reset()
    current.reset()
    expect(isMatching(ref, 'first')).toBe(false)
    isMatching(bind, 'first')
    current.reset()
    expect(isMatching(ref, 'first')).toBe(false)
    isMatching(bind, 'second')
    expect(isMatching(ref, 'second')).toBe(true)
  })

  it('provides stable pattern objects across resets', () => {
    const current = binding()
    const { bind, ref } = current

    current.reset()
    expect(current).toMatchObject({ bind, ref })
    expect(current.bind).toBe(bind)
    expect(current.ref).toBe(ref)
  })

  it('compares objects by identity after their contents change', () => {
    const { bind, ref } = binding<{ id: number }>()
    const value = { id: 1 }

    isMatching(bind)(value)
    value.id = 2
    expect(isMatching(ref)(value)).toBe(true)
    expect(isMatching(ref)({ id: 2 })).toBe(false)
  })

  it('implements the public matcher protocol without selections', () => {
    const { bind, ref } = binding<string>()
    const { match: bindValue } = bind[P.matcher]()
    const { match: referenceValue } = ref[P.matcher]()

    expect(referenceValue('value')).toEqual({ matched: false })
    expect(bindValue('value')).toEqual({ matched: true })
    expect(referenceValue('value')).toEqual({ matched: true })
    expect(referenceValue('other')).toEqual({ matched: false })
  })

  it('does not treat a generic argument as a runtime type guard', () => {
    const { bind, ref } = binding<string>()

    expect(isMatching([bind, ref], [1, 1])).toBe(true)
  })

  it('agrees with Object.is for arbitrary value pairs', () => {
    fc.assert(
      fc.property(fc.anything(), fc.anything(), (left, right) => {
        const { bind, ref } = binding()

        expect(isMatching([bind, ref], [left, right])).toBe(
          Object.is(left, right)
        )
      }),
      { numRuns: 1000 }
    )
  })

  it('matches arbitrary values against the same value', () => {
    fc.assert(
      fc.property(fc.anything(), (value) => {
        const { bind, ref } = binding()

        expect(isMatching([bind, ref], [value, value])).toBe(true)
      }),
      { numRuns: 1000 }
    )
  })

  it('rebinds and resets across arbitrary operation sequences', () => {
    fc.assert(
      fc.property(fc.array(fc.anything(), { minLength: 1 }), (values) => {
        const current = binding()
        const { bind, ref } = current

        for (const value of values) {
          expect(isMatching(bind, value)).toBe(true)
          expect(isMatching(ref, value)).toBe(true)
          current.reset()
          expect(isMatching(ref, value)).toBe(false)
        }
      }),
      { numRuns: 500 }
    )
  })
})

describe('ts-pattern integration', () => {
  it('matches the original nested-object example', () => {
    const { bind, ref } = binding<string>()

    const result = match({
      a: { current: 'same', id: 'a' },
      b: { current: 'same', id: 'b' }
    })
      .with(
        { a: { current: bind }, b: { current: ref } },
        ({ a: { id: first }, b: { id: second } }) => [first, second]
      )
      .otherwise(() => [])

    expect(result).toEqual(['a', 'b'])
  })

  it('uses the fallback for unequal nested values', () => {
    const { bind, ref } = binding<string>()

    const result = match({ a: { current: 'first' }, b: { current: 'second' } })
      .with({ a: { current: bind }, b: { current: ref } }, () => 'equal')
      .otherwise(() => 'different')

    expect(result).toBe('different')
  })

  it('uses the order of pattern properties, independent of input order', () => {
    const { bind, ref } = binding<string>()

    expect(isMatching({ a: bind, b: ref }, { b: 'same', a: 'same' })).toBe(true)
  })

  it('fails when a fresh reference precedes its bind', () => {
    const { bind, ref } = binding<string>()

    expect(isMatching({ b: ref, a: bind }, { a: 'same', b: 'same' })).toBe(
      false
    )
  })

  it('uses numeric property order rather than insertion order', () => {
    const { bind, ref } = binding<string>()

    expect(isMatching({ 2: bind, 1: ref }, { 1: 'same', 2: 'same' })).toBe(
      false
    )
  })

  it('supports several references to one bind', () => {
    const { bind, ref } = binding<number>()

    expect(isMatching([bind, ref, ref], [42, 42, 42])).toBe(true)
    expect(isMatching([bind, ref, ref], [42, 42, 43])).toBe(false)
  })

  it('supports multiple independent bindings in one pattern', () => {
    const { bind: bindName, ref: sameName } = binding<string>()
    const { bind: bindId, ref: sameId } = binding<number>()
    const pattern = [bindName, bindId, sameName, sameId] satisfies P.Pattern<
      [string, number, string, number]
    >

    expect(isMatching(pattern, ['first', 1, 'first', 1])).toBe(true)
    expect(isMatching(pattern, ['first', 1, 'second', 1])).toBe(false)
    expect(isMatching(pattern, ['first', 1, 'first', 2])).toBe(false)
  })

  it('combines bind and ref with runtime type guards', () => {
    const { bind, ref } = binding<string>()
    const pattern = {
      a: P.intersection(P.string, bind),
      b: P.intersection(P.string, ref)
    }

    expect(isMatching(pattern, { a: 'same', b: 'same' })).toBe(true)
    expect(isMatching(pattern, { a: 1, b: 1 })).toBe(false)
  })

  it('preserves named selections', () => {
    const { bind, ref } = binding<string>()

    const result = match({ first: 'same', second: 'same', extra: 42 })
      .with(
        { first: P.select('current', bind), second: ref },
        ({ current }) => current
      )
      .otherwise(() => 'different')

    expect(result).toBe('same')
  })

  it('preserves anonymous selections', () => {
    const { bind, ref } = binding<string>()

    const result = match(['same', 'same'])
      .with([P.select(bind), ref], (value) => value)
      .otherwise(() => 'different')

    expect(result).toBe('same')
  })

  it('supports a curried isMatching pattern with a bind on every call', () => {
    const { bind, ref } = binding<string>()
    const equal = isMatching({ a: bind, b: ref })

    expect(equal({ a: 'first', b: 'first' })).toBe(true)
    expect(equal({ a: 'second', b: 'first' })).toBe(false)
    expect(equal({ a: 'second', b: 'second' })).toBe(true)
  })

  it('creates independent bindings inside repeated function calls', () => {
    const equal = (a: string, b: string): boolean => {
      const { bind, ref } = binding<string>()

      return isMatching({ a: bind, b: ref }, { a, b })
    }

    expect(equal('first', 'first')).toBe(true)
    expect(equal('second', 'first')).toBe(false)
    expect(equal('second', 'second')).toBe(true)
  })

  it('handles each array element when each element visits bind first', () => {
    const { bind, ref } = binding<number>()
    const pattern = P.array({ a: bind, b: ref })

    expect(isMatching(pattern, [])).toBe(true)
    expect(
      isMatching(pattern, [
        { a: 1, b: 1 },
        { a: 2, b: 2 }
      ])
    ).toBe(true)
    expect(
      isMatching(pattern, [
        { a: 1, b: 1 },
        { a: 2, b: 1 }
      ])
    ).toBe(false)
  })

  it('requires a fallback even for a literal input with equal fields', () => {
    const { bind, ref } = binding<number>()

    const result = match({ a: 1, b: 1 })
      .with({ a: bind, b: ref }, () => 'equal')
      .with(P._, () => 'different')
      .exhaustive()

    expect(result).toBe('equal')
  })
})

describe('state lifetime', () => {
  it('does not roll back bind after a later property fails', () => {
    const { bind, ref } = binding<string>()
    const input: { a: string; enabled: boolean } = {
      a: 'stale',
      enabled: false
    }

    expect(isMatching({ a: bind, enabled: true }, input)).toBe(false)
    expect(isMatching(ref, 'stale')).toBe(true)
  })

  it('does not roll back bind after a guard rejects a branch', () => {
    const { bind, ref } = binding<string>()

    const result = match({ a: 'stale' })
      .with(
        { a: bind },
        () => false,
        () => 'accepted'
      )
      .otherwise(() => 'rejected')

    expect(result).toBe('rejected')
    expect(isMatching(ref, 'stale')).toBe(true)
  })

  it('retains earlier state when a later input never visits bind', () => {
    const { bind, ref } = binding<string>()

    isMatching(bind, 'stale')
    expect(isMatching({ a: bind, b: ref }, { b: 'stale' })).toBe(false)
    expect(isMatching(ref, 'stale')).toBe(true)
  })

  it('overwrites state when bind occurs more than once', () => {
    const { bind, ref } = binding<number>()

    expect(isMatching([bind, bind, ref], [1, 2, 2])).toBe(true)
    expect(isMatching([bind, bind, ref], [1, 2, 1])).toBe(false)
  })

  it('can carry state from a failed union alternative', () => {
    const { bind, ref } = binding<string>()
    const pattern = P.union({ a: bind, enabled: true }, { a: ref })
    const input: { a: string; enabled: boolean } = {
      a: 'stale',
      enabled: false
    }

    expect(isMatching(pattern)(input)).toBe(true)
  })

  it('can carry state from a failed with branch', () => {
    const { bind, ref } = binding<string>()

    const result = match<{ a: string; enabled: boolean }>({
      a: 'stale',
      enabled: false
    })
      .with({ a: bind, enabled: true }, () => 'first')
      .with({ a: ref }, () => 'second')
      .otherwise(() => 'fallback')

    expect(result).toBe('second')
  })

  it('keeps alternatives independent with separate bindings', () => {
    const { bind: firstBind } = binding<string>()
    const { ref: secondRef } = binding<string>()

    const result = match<{ a: string; enabled: boolean }>({
      a: 'stale',
      enabled: false
    })
      .with({ a: firstBind, enabled: true }, () => 'first')
      .with({ a: secondRef }, () => 'second')
      .otherwise(() => 'fallback')

    expect(result).toBe('fallback')
  })
})
