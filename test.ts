import { computed, makeObservable, observable } from "mobx";

// ============================================================
// Test 1: Simple inheritance (makeObservable + @computed override)
// ============================================================
console.log("\n=== Test 1: Simple makeObservable + @computed override ===");

class Base1 {
  _value = false;

  get value() {
    return this._value;
  }

  constructor() {
    makeObservable(this, {
      _value: observable,
      value: computed,
    });
  }
}

class Child1 extends Base1 {
  @computed
  override get value() {
    return super.value;
  }
}

try {
  const child = new Child1();
  console.log("Accessing child.value...");
  const result = child.value;
  console.log("Result:", result);
  console.log("FAIL: No cycle detected — bug is NOT reproduced");
} catch (e) {
  if (e instanceof Error && e.message.includes("Cycle detected")) {
    console.log("OK: Cycle detected — bug IS reproduced!");
  } else {
    throw e;
  }
}

// ============================================================
// Test 2: With intermediate class (like RouteViewModel)
// This more closely matches the real ProductsPageVM scenario
// ============================================================
console.log("\n=== Test 2: With intermediate class ===");

class ViewModelBase {
  _isMounted = false;

  get isMounted() {
    return this._isMounted;
  }

  constructor() {
    makeObservable(this, {
      _isMounted: observable,
      isMounted: computed,
    });
  }
}

class RouteViewModel extends ViewModelBase {
  // Intermediate class overrides isMounted WITHOUT @computed decorator
  // (uses plain getter, like the real RouteViewModel)
  override get isMounted() {
    return super.isMounted && true; // simulates && this.route.isOpened
  }
}

class ProductsPageVM extends RouteViewModel {
  // Child class overrides with @computed — THIS triggers the bug
  @computed
  override get isMounted() {
    return super.isMounted;
  }
}

try {
  const vm = new ProductsPageVM();
  console.log("Accessing vm.isMounted...");
  const result = vm.isMounted;
  console.log("Result:", result);
  console.log("FAIL: No cycle detected — bug is NOT reproduced");
} catch (e) {
  if (e instanceof Error && e.message.includes("Cycle detected")) {
    console.log("OK: Cycle detected — bug IS reproduced!");
  } else {
    throw e;
  }
}

// ============================================================
// Test 3: @computed on BOTH parent and child (no makeObservable)
// ============================================================
console.log("\n=== Test 3: @computed on both parent and child ===");

class Parent3 {
  @observable accessor _value = false;

  @computed
  get value() {
    return this._value;
  }
}

class Child3 extends Parent3 {
  @computed
  override get value() {
    return super.value;
  }
}

try {
  const child = new Child3();
  console.log("Accessing child.value...");
  const result = child.value;
  console.log("Result:", result);
  console.log("FAIL: No cycle detected — bug is NOT reproduced");
} catch (e) {
  if (e instanceof Error && e.message.includes("Cycle detected")) {
    console.log("OK: Cycle detected — bug IS reproduced!");
  } else {
    throw e;
  }
}

// ============================================================
// Test 4: Only @computed on child, no computed on parent
// (parent is just a plain getter, no makeObservable for this key)
// ============================================================
console.log("\n=== Test 4: @computed only on child, parent has plain getter ===");

class Base4 {
  _value = false;

  get value() {
    return this._value;
  }

  constructor() {
    makeObservable(this, {
      _value: observable,
    });
    // Note: `value` is NOT annotated as computed in the base class
  }
}

class Child4 extends Base4 {
  @computed
  override get value() {
    return super.value;
  }
}

try {
  const child = new Child4();
  console.log("Accessing child.value...");
  const result = child.value;
  console.log("Result:", result);
  console.log("INFO: No cycle — parent getter not annotated");
} catch (e) {
  if (e instanceof Error && e.message.includes("Cycle detected")) {
    console.log("Cycle detected in test 4!");
  } else {
    throw e;
  }
}

console.log("\n=== Summary ===");
console.log("The bug occurs when:");
console.log("1. Base class uses makeObservable to annotate a computed property");
console.log("2. Child class overrides the same property with @computed decorator");
console.log("3. makeObservable walks the prototype chain and finds the decorator's");
console.log("   replacement getter on the child's prototype, creating a cyclic ComputedValue");
console.log("4. In 6.16.0, the lazy @computed factory never overwrites this cyclic value");
