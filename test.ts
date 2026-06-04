import { computed, makeObservable, observable } from "mobx";

// ============================================================
// Test 1: makeObservable + @computed override (6.16.0 regression)
// ============================================================
console.log("\n=== Test 1: makeObservable + @computed override ===");

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
  const result = child.value;
  child._value = true;
  console.log(result === false && child.value === true ? "PASS" : "FAIL: wrong values");
} catch (e) {
  console.log("FAIL:", (e as Error).message.split("\n")[0]);
}

// ============================================================
// Test 2: With intermediate class (like RouteViewModel)
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
  override get isMounted() {
    return super.isMounted && true;
  }
}

class ProductsPageVM extends RouteViewModel {
  @computed
  override get isMounted() {
    return super.isMounted;
  }
}

try {
  const vm = new ProductsPageVM();
  const result = vm.isMounted;
  vm._isMounted = true;
  console.log(result === false && vm.isMounted === true ? "PASS" : "FAIL: wrong values");
} catch (e) {
  console.log("FAIL:", (e as Error).message.split("\n")[0]);
}

// ============================================================
// Test 3: @computed on BOTH parent and child (pre-existing bug)
// This was broken in ALL versions before this fix.
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
  const result = child.value;
  child._value = true;
  console.log(result === false && child.value === true ? "PASS" : "FAIL: wrong values");
} catch (e) {
  console.log("FAIL:", (e as Error).message.split("\n")[0]);
}

// ============================================================
// Test 4: @computed on both with super.value + 1
// ============================================================
console.log("\n=== Test 4: @computed override with super.value + 1 ===");

class Parent4 {
  @computed
  get number() {
    return 1;
  }
}

class Child4 extends Parent4 {
  @computed
  override get number() {
    return super.number + 1;
  }
}

try {
  const child = new Child4();
  console.log(child.number === 2 ? "PASS" : "FAIL: got " + child.number);
} catch (e) {
  console.log("FAIL:", (e as Error).message.split("\n")[0]);
}

// ============================================================
// Test 5: Three levels of @computed inheritance
// ============================================================
console.log("\n=== Test 5: Three levels of @computed inheritance ===");

class GrandParent {
  @computed
  get number() {
    return 1;
  }
}

class Parent5 extends GrandParent {
  @computed
  override get number() {
    return super.number + 1;
  }
}

class Child5 extends Parent5 {
  @computed
  override get number() {
    return super.number + 1;
  }
}

try {
  const child = new Child5();
  console.log(child.number === 3 ? "PASS" : "FAIL: got " + child.number);
} catch (e) {
  console.log("FAIL:", (e as Error).message.split("\n")[0]);
}
