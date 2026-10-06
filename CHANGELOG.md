# Changelog

## 0.3.0

- Add `binding(callback)` and `binding(pattern, callback)` to construct patterns without external binding declarations.
- Preserve pattern inference, selections, composition, and the existing binding lifecycle in callback forms.

## 0.2.0

- Accept an optional ts-pattern pattern in `binding` and `new Binding`.
- Infer the supplied pattern's type for both `bind` and `ref`, including refs in handlers and selections.
- Validate constrained values before a bind and recheck matching refs, including retained objects whose contents change.
- Preserve unknown inference when no pattern is supplied and keep existing generic calls compatible.
- Keep partial patterns non-exhaustive, including regular-expression guards.
- Replace the README examples with nested order and payment customer IDs.

## 0.1.1

- Publish through GitHub Actions with npm provenance.
- Document trusted publisher setup through the npm CLI.

## 0.1.0

- Add `binding()` and the `Binding` class.
- Add `bind` and `ref` patterns with `Object.is` equality.
- Add `reset()` for explicit state lifetime.
- Preserve input types and bound-value selections without claiming equality-dependent exhaustiveness.
- Publish ESM, CommonJS, and declarations for both formats.
