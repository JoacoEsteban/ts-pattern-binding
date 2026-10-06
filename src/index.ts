import { P, isMatching, match } from 'ts-pattern'

declare const bindingInput: unique symbol

export type BindingPattern<T = unknown, Narrowed = unknown> = ReturnType<
  typeof P.when<unknown, Narrowed, never>
> & { readonly [bindingInput]?: T }

export type ReferencePattern<T = unknown, Narrowed = unknown> = ReturnType<
  typeof P.when<unknown, Narrowed, never>
> & { readonly [bindingInput]?: T }

export class Binding<
  T = unknown,
  const Pattern extends P.Pattern = typeof P._
> {
  #state: { readonly value: unknown } | undefined

  readonly bind: BindingPattern<T, P.infer<Pattern>>
  readonly ref: ReferencePattern<T, P.infer<Pattern>>

  constructor(
    ...patterns: unknown extends P.infer<Pattern>
      ? [pattern?: Pattern]
      : [pattern: Pattern]
  ) {
    const supplied: readonly P.Pattern[] = patterns
    const accepts = match(supplied)
      .with([], () => isMatching(P._))
      .otherwise(([pattern]) => isMatching(pattern))

    this.bind = P.when((value: unknown): value is P.infer<Pattern> =>
      match(value)
        .with(P.when(accepts), (value) => {
          this.#state = { value }

          return true
        })
        .otherwise(() => false)
    )

    this.ref = P.when<unknown, P.infer<Pattern>, never>(
      (value: unknown): value is P.infer<Pattern> =>
        match(this.#state)
          .with(
            { value: P.select() },
            (boundValue) => Object.is(value, boundValue) && accepts(value)
          )
          .otherwise(() => false)
    )
  }

  reset(): void {
    this.#state = undefined
  }
}

export function binding<T = unknown>(): Binding<T>
export function binding<const Pattern extends P.Pattern>(
  pattern: Pattern
): Binding<P.infer<Pattern>, Pattern>
export function binding(...patterns: [] | [P.Pattern]): Binding {
  return match(patterns)
    .with([], () => new Binding())
    .otherwise(([pattern]) => new Binding(pattern))
}
