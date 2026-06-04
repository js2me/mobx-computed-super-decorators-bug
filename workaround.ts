import { computed, makeObservable, observable } from "mobx";

// ============================================================
// Workaround for the real ProductsPageVM scenario:
// Replace @computed with plain getter override
// ============================================================
console.log("\n=== Workaround: ProductsPageVM-like scenario ===");

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
  // BEFORE (broken in 6.16.0):
  // @computed
  // override get isMounted() { return super.isMounted; }

  // AFTER (workaround):
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
  console.log("Setting _isMounted to true...");
  vm._isMounted = true;
  console.log("New result:", vm.isMounted);
  console.log("OK: No cycle — workaround works!");
} catch (e) {
  if (e instanceof Error && e.message.includes("Cycle detected")) {
    console.log("FAIL: Cycle detected — workaround does NOT work");
  } else {
    throw e;
  }
}

// ============================================================
// Also test the service-table-card-like scenario:
// @computed get isMounted() { return !this.isLoading && super.isMounted; }
// ============================================================
console.log("\n=== Workaround: ServiceTableCard-like scenario ===");

class ServiceTableVM extends RouteViewModel {
  _isLoading = false;

  // BEFORE (broken in 6.16.0):
  // @computed
  // override get isMounted() { return !this._isLoading && super.isMounted; }
  //
  // @computed
  // get isLoading() { return this._isLoading; }

  // AFTER (workaround):
  override get isMounted() {
    return !this._isLoading && super.isMounted;
  }

  get isLoading() {
    return this._isLoading;
  }

  constructor() {
    super();
    // isMounted is already computed-annotated by ViewModelBase.
    // makeObservable in base class walks the prototype chain and finds
    // this override getter — it works correctly without re-annotating.
    makeObservable(this, {
      _isLoading: observable,
      isLoading: computed,
      // NO isMounted here — base class already annotated it
    });
  }
}

try {
  const vm = new ServiceTableVM();
  console.log("Accessing vm.isMounted...");
  const result = vm.isMounted;
  console.log("Result:", result);

  // Verify reactivity
  console.log("Mounting and loading...");
  vm._isMounted = true;
  vm._isLoading = true;
  console.log("isMounted while loading:", vm.isMounted);
  vm._isLoading = false;
  console.log("isMounted after loading:", vm.isMounted);
  console.log("OK: No cycle — workaround works!");
} catch (e) {
  if (e instanceof Error && e.message.includes("Cycle detected")) {
    console.log("FAIL: Cycle detected — workaround does NOT work");
  } else {
    throw e;
  }
}
