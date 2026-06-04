# MobX @computed Inheritance Cycle Bug Reproduction

## Bug

When a child class overrides a computed property with `@computed` (2022.3 decorator)
and calls `super.prop`, MobX throws:

```
[MobX] Cycle detected in computation
```

This occurs in two scenarios:

1. **makeObservable parent + @computed child** — regression introduced in MobX 6.16.0
2. **@computed parent + @computed child** — pre-existing bug in all versions

## Run

```bash
npm install
npm test
```

## Root Cause

### How `@computed` works (2022.3 decorator)

The `@computed` decorator does two things:

1. **Replaces the prototype getter** with a replacement that calls
   `this[$mobx].getObservablePropValue_(key)`.
2. **Registers an `addInitializer`** that registers a lazy factory for the actual
   `ComputedValue` using the **original** getter.

### The problem (makeObservable parent + @computed child)

When `makeObservable` runs in the base class constructor, its `make_` method
walks the prototype chain and finds the descriptor on the child's prototype —
but `@computed` has already replaced that getter with the replacement
(`getObservablePropValue_`). MobX creates a `ComputedValue` using this
replacement getter as the derivation, which calls `getObservablePropValue_(key)`
on the same key → **self-referencing cycle**.

### The problem (@computed parent + @computed child)

Both parent and child have replacement getters on their respective prototypes.
When the child's replacement getter is invoked, it calls `getObservablePropValue_(key)`.
MobX finds the **parent's** `ComputedValue` in `values_` (stored under the same
property key), and the parent's `ComputedValue` getter is the parent's replacement
getter — which also calls `getObservablePropValue_(key)` → **cycle**.

The fundamental issue is that replacement getters from different classes all
look up by the same property key, so `super.prop` resolves to the same
`ComputedValue` as the child's own lookup.

### Why it worked in 6.15.x (makeObservable + @computed only)

In 6.15.x, the `addInitializer` from `@computed` **eagerly** created a new
`ComputedValue` and overwrote the cyclic one in `adm.values_`. The cyclic
`ComputedValue` was replaced before anyone could access it.

In 6.16.0, the `addInitializer` registers a **lazy factory** instead. The
cyclic `ComputedValue` in `values_` is found first, and the lazy factory is
never materialized.

## Fix

The replacement getter now looks up by **getter function reference** instead of
property key. This way each class's `@computed` decorator resolves to its own
`ComputedValue`, and `super.prop` correctly resolves to the parent's.

### computedannotation.ts — `decorate_20223_`

```ts
addInitializer(function () {
    const adm: ObservableObjectAdministration = asObservableObject(this)[$mobx]
    const target = this
    adm.values_.delete(key)
    ;(adm.getterToPropKey_ ??= new Map()).set(get, key)
    let cached: ComputedValue<any> | undefined
    const factory = () => {
        if (cached) return cached
        const options = {
            ...ann.options_,
            get,
            context: target
        }
        options.name ||= __DEV__
            ? `${adm.name_}.${key.toString()}`
            : `ObservableObject.${key.toString()}`
        cached = new ComputedValue(options)
        return cached
    }
    ;(adm.lazyComputedKeys_ ??= new Map()).set(key, factory)
    ;(adm.lazyComputedKeys_ ??= new Map()).set(get, factory)
})

return function () {
    return this[$mobx].getObservablePropValue_(get)
}
```

The replacement getter calls `getObservablePropValue_(get)` — passing the
original getter function as the lookup key, not the property name. This ensures
each class's `@computed` gets its own `ComputedValue`, and `super.prop`
correctly resolves to the parent's `ComputedValue` instead of the child's.

### observableobject.ts — `getObservablePropValue_` and `materializeLazyComputed_`

```ts
getterToPropKey_: undefined | Map<Function, PropertyKey>
lazyComputedKeys_: undefined | Map<PropertyKey | Function, () => ComputedValue<any>>

getObservablePropValue_(key: PropertyKey | Function): any {
    const observable =
        this.values_.get(key as PropertyKey) ??
        this.materializeLazyComputed_(key) ??
        this.materializeLazyObservable_(key as PropertyKey)
    return observable!.get()
}

materializeLazyComputed_(key: PropertyKey | Function): ComputedValue<any> | undefined {
    const factory = this.lazyComputedKeys_?.get(key)
    if (!factory) return undefined
    this.lazyComputedKeys_!.delete(key)
    const propKey = typeof key === "function" ? this.getterToPropKey_?.get(key) : key
    if (propKey) this.lazyComputedKeys_!.delete(propKey)
    if (this.lazyComputedKeys_!.size === 0) this.lazyComputedKeys_ = undefined
    const computed = factory()
    this.values_.set(key as PropertyKey, computed)
    if (propKey) this.values_.set(propKey, computed)
    return computed
}
```

All 1049 MobX tests pass with this fix.
