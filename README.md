# MobX 6.16.0 Cycle Detection Bug Reproduction

## Bug

When a base class uses `makeObservable` to annotate a computed property, and a
child class overrides that same property with the `@computed` decorator
(2022.3 style), accessing the property throws:

```
[MobX] Cycle detected in computation
```

This bug was introduced in MobX 6.16.0 and does not occur in 6.15.x.

## Run

```bash
npm install
npm test         # reproduces the bug
npx tsx workaround.ts  # shows the workaround
```

## Root Cause

### How `@computed` works (2022.3 decorator)

The `@computed` decorator does two things:

1. **Replaces the prototype getter** with a replacement that calls
   `this[$mobx].getObservablePropValue_(key)`.
2. **Registers an `addInitializer`** that creates/registers the actual
   `ComputedValue` using the **original** getter.

### The problem

When `makeObservable` runs in the base class constructor, its `make_` method
walks the prototype chain looking for the property descriptor:

```
instance → Child.prototype → Parent.prototype → ...
```

It finds the descriptor on `Child.prototype` — but `@computed` has already
replaced that getter with the replacement (`getObservablePropValue_`). MobX
creates a `ComputedValue` using this replacement getter as the derivation,
which calls `getObservablePropValue_(key)` on the same key → **self-referencing
cycle**.

### Why it worked in 6.15.x

In 6.15.x, the `addInitializer` from `@computed` **eagerly** created a new
`ComputedValue` and overwrote the cyclic one in `adm.values_`:

```js
// v6.15.x — eager
addInitializer(function () {
    adm.values_.set(key, new ComputedValue({ get: originalGetter }))
})
```

The cyclic `ComputedValue` was replaced before anyone could access it.

### Why it breaks in 6.16.0

In 6.16.0, the `addInitializer` registers a **lazy factory** instead:

```js
// v6.16.0 — lazy
addInitializer(function () {
    adm.lazyComputedKeys_.set(key, () => new ComputedValue({ get: originalGetter }))
})
```

`getObservablePropValue_` now checks `values_` first, then lazy factories:

```js
getObservablePropValue_(key) {
    const observable =
        this.values_.get(key) ??           // ← finds cyclic ComputedValue here!
        this.materializeLazyComputed_(key) ??  // ← never reached
        this.materializeLazyObservable_(key)
    return observable.get()
}
```

The cyclic `ComputedValue` in `values_` is found first, and the lazy factory
is never materialized.

## Minimal Reproduction

```ts
import { computed, makeObservable, observable } from "mobx"

class Base {
  _value = false
  get value() { return this._value }

  constructor() {
    makeObservable(this, { _value: observable, value: computed })
  }
}

class Child extends Base {
  @computed
  override get value() { return super.value }
}

new Child().value  // Cycle detected!
```

## Workaround

Remove `@computed` from the child class override. The base class's
`makeObservable` already walks the prototype chain and will find the child's
overridden getter, so `@computed` is unnecessary:

```ts
// BEFORE (broken in 6.16.0):
class ProductsPageVM extends RouteViewModel {
  @computed
  override get isMounted() { return super.isMounted }
}

// AFTER (workaround):
class ProductsPageVM extends RouteViewModel {
  override get isMounted() { return super.isMounted }
}
```

The base class's `makeObservable` already annotated `isMounted` as `computed`,
so the overridden getter on the child's prototype is picked up automatically.
No re-annotation is needed (and attempting it would throw
"field is already annotated").

## MobX Fix Options

1. **Skip decorated descriptors in `make_`**: When walking the prototype chain,
   detect that a descriptor's getter is the replacement from `decorate_20223_`
   and skip it, continuing to walk up to find the original getter.

2. **Lazy factory overwrites `values_`**: When `materializeLazyComputed_`
   creates a `ComputedValue`, it should overwrite any existing entry in
   `values_` for the same key (not just insert if missing).

3. **Eager overwrite on lazy registration**: When the `@computed` lazy factory
   is registered, also delete the existing entry from `values_` so the lazy
   path is taken on next access.
