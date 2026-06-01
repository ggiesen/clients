import { UsingRequired } from "../using-required";

export type Freeable = { free: () => void };

/**
 * Reference counted disposable value.
 * This class is used to manage the lifetime of a value that needs to be
 * freed of at a specific time but might still be in-use when that happens.
 */
export class Rc<T extends Freeable> {
  private _markedForDisposal = false;
  private refCount = 0;
  private value: T;

  constructor(value: T) {
    this.value = value;
  }

  /**
   * Whether this Rc has been marked for disposal. Once true, {@link take} will throw.
   * Exposed so that sources sharing an Rc via a buffered subject (e.g. ReplaySubject)
   * can filter out emissions whose Rc has been marked between buffer time and replay,
   * avoiding races where late subscribers receive a no-longer-takeable Rc.
   */
  get markedForDisposal(): boolean {
    return this._markedForDisposal;
  }

  /**
   * Use this function when you want to use the underlying object.
   * This will guarantee that you have a reference to the object
   * and that it won't be freed until your reference goes out of scope.
   *
   * This function must be used with the `using` keyword.
   *
   * @example
   * ```typescript
   * function someFunction(rc: Rc<SomeValue>) {
   *   using reference = rc.take();
   *   reference.value.doSomething();
   *   // reference is automatically disposed here
   * }
   * ```
   *
   * @returns The value.
   */
  take(): Ref<T> {
    if (this._markedForDisposal) {
      throw new Error("Cannot take a reference to a value marked for disposal");
    }

    this.refCount++;
    return new Ref(() => this.release(), this.value);
  }

  /**
   * Mark this Rc for disposal. When the refCount reaches 0, the value
   * will be freed.
   */
  markForDisposal() {
    this._markedForDisposal = true;
    this.freeIfPossible();
  }

  private release() {
    this.refCount--;
    this.freeIfPossible();
  }

  private freeIfPossible() {
    if (this.refCount === 0 && this._markedForDisposal) {
      this.value.free();
    }
  }
}

export class Ref<T extends Freeable> implements UsingRequired {
  constructor(
    private readonly release: () => void,
    readonly value: T,
  ) {}

  [Symbol.dispose]() {
    this.release();
  }
}
