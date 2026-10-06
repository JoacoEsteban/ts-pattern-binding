import { P, match } from 'ts-pattern'

declare const bindingInput: unique symbol

export type BindingPattern<T = unknown> = ReturnType<
  typeof P.when<unknown, unknown, unknown>
> & { readonly [bindingInput]?: T }

export type ReferencePattern<T = unknown> = ReturnType<
  typeof P.when<unknown, never, never>
> & { readonly [bindingInput]?: T }

export class Binding<T = unknown> {
  #state: { readonly value: unknown } | undefined

  readonly bind: BindingPattern<T> = P.when(
    (value: unknown): value is unknown => {
      this.#state = { value }

      return true
    }
  )

  readonly ref: ReferencePattern<T> = P.when((value: unknown): boolean =>
    match(this.#state)
      .with({ value: P.select() }, (boundValue) => Object.is(value, boundValue))
      .otherwise(() => false)
  )

  reset(): void {
    this.#state = undefined
  }
}

export const binding = <T = unknown>(): Binding<T> => new Binding<T>()
