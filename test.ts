import { computed, makeObservable, observable } from "mobx";

// ============================================================
// Test 1: Simple inheritance (makeObservable + @computed override)
// This is the core 6.16.0 regression bug.
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

  // Verify reactivity
  child._value = true;
  console.log("After setting _value=true:", child.value);

  console.log("PASS: No cycle, reactivity works!");
} catch (e) {
  if (e instanceof Error && e.message.includes("Cycle detected")) {
    console.log("FAIL: Cycle detected — bug IS reproduced!");
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
  // Child class overrides with @computed — THIS was the bug
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

  // Verify reactivity
  vm._isMounted = true;
  console.log("After mounting:", vm.isMounted);

  console.log("PASS: No cycle, reactivity works!");
} catch (e) {
  if (e instanceof Error && e.message.includes("Cycle detected")) {
    console.log("FAIL: Cycle detected — bug IS reproduced!");
  } else {
    throw e;
  }
}

// ============================================================
// Test 3: Only @computed on child, no computed on parent
// (parent is just a plain getter, no makeObservable for this key)
// This should always work — parent getter is not annotated.
// ============================================================
console.log("\n=== Test 3: @computed only on child, parent has plain getter ===");

class Base3 {
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

class Child3 extends Base3 {
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
  console.log("PASS: No cycle — parent getter not annotated");
} catch (e) {
  if (e instanceof Error && e.message.includes("Cycle detected")) {
    console.log("FAIL: Cycle detected in test 3!");
  } else {
    throw e;
  }
}
