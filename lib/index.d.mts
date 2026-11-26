/**
 * dsh-plugin-memory-handoff — 把「进度」放在上下文外面，而不是放在上下文里。
 *
 * 解决三件平台没做的事（都对着上游代码确认过）：
 *   1. 跨会话记忆：平台有会话存盘与全文搜索，但不会主动告诉模型「这件事还没做完」。
 *   2. 状态标记：pending / done / dropped，dropped 永不再提。
 *   3. 压缩即存档：订阅 compaction 事件的类型声明，压缩发生时把 summary 落到 handoff 文件。
 *
 * 不做的事（守边界）：
 *   · 不接管压缩（compaction-basic 已做：阈值 min(W*0.8, W-O-65536)）
 *   · 不拆重构会话存储（session-persistence 已做）
 *   · 不自动 fork（fork 是 remote.session.fork 契约，由上层决定何时调用）
 */
declare function isArrayBufferLike(value: any): value is ArrayBufferLike;
declare function isArrayBufferSource(value: any): value is Binary.Source;
/** Binary source detection and base64/hex conversion helpers. */
declare namespace Binary {
  type Source<T extends ArrayBufferLike = ArrayBufferLike> = T | ArrayBufferView<T>;
  const is: typeof isArrayBufferLike;
  const isSource: typeof isArrayBufferSource;
  function fromSource<T extends ArrayBufferLike>(source: Source<T>): T;
  function toBase64(source: Source): string;
  function fromBase64(source: string): ArrayBuffer | Uint8Array<ArrayBuffer>;
  function toHex(source: Source): string;
  function fromHex(source: string): ArrayBuffer;
}
/** String/symbol keyed dictionary type. */
type Dict<T = any, K extends string | symbol = string> = { [key in K]: T; };
/** Wrap a value in `Promise`, preserving the resolved type of existing promises. */
type Promisify<T> = Promise<T extends Promise<infer S> ? S : T>;
/** Accept a value or promise unless the value type is already promise-like. */
type Awaitable<T> = [T] extends [Promise<unknown>] ? T : T | Promise<T>;
/** Shared config references used by schema validators and plugin runtimes. */
/** Recursively readonly data returned by a volatile config reference. */
type VolatileSnapshot<T> = T extends object ? { readonly [K in keyof T]: VolatileSnapshot<T[K]>; } : T;
/** A stable reference; keep the reference, or capture its value for one operation only. */
interface Volatile<T> {
  /** @returns the current immutable snapshot, including undefined for an absent value. */
  get(): VolatileSnapshot<T>;
}
/** The Standard Typed interface. This is a base type extended by other specs. */
interface StandardTypedV1<Input = unknown, Output = Input> {
  /** The Standard properties. */
  readonly "~standard": StandardTypedV1.Props<Input, Output>;
}
declare namespace StandardTypedV1 {
  /** The Standard Typed properties interface. */
  interface Props<Input = unknown, Output = Input> {
    /** The version number of the standard. */
    readonly version: 1;
    /** The vendor name of the schema library. */
    readonly vendor: string;
    /** Inferred types associated with the schema. */
    readonly types?: Types<Input, Output> | undefined;
  }
  /** The Standard Typed types interface. */
  interface Types<Input = unknown, Output = Input> {
    /** The input type of the schema. */
    readonly input: Input;
    /** The output type of the schema. */
    readonly output: Output;
  }
  /** Infers the input type of a Standard Typed. */
  type InferInput<Schema extends StandardTypedV1> = NonNullable<Schema["~standard"]["types"]>["input"];
  /** Infers the output type of a Standard Typed. */
  type InferOutput<Schema extends StandardTypedV1> = NonNullable<Schema["~standard"]["types"]>["output"];
}
/** The Standard Schema interface. */
interface StandardSchemaV1<Input = unknown, Output = Input> {
  /** The Standard Schema properties. */
  readonly "~standard": StandardSchemaV1.Props<Input, Output>;
}
declare namespace StandardSchemaV1 {
  /** The Standard Schema properties interface. */
  interface Props<Input = unknown, Output = Input> extends StandardTypedV1.Props<Input, Output> {
    /** Validates unknown input values. */
    readonly validate: (value: unknown, options?: StandardSchemaV1.Options | undefined) => Result<Output> | Promise<Result<Output>>;
  }
  /** The result interface of the validate function. */
  type Result<Output> = SuccessResult<Output> | FailureResult;
  /** The result interface if validation succeeds. */
  interface SuccessResult<Output> {
    /** The typed output value. */
    readonly value: Output;
    /** A falsy value for `issues` indicates success. */
    readonly issues?: undefined;
  }
  interface Options {
    /** Explicit support for additional vendor-specific parameters, if needed. */
    readonly libraryOptions?: Record<string, unknown> | undefined;
  }
  /** The result interface if validation fails. */
  interface FailureResult {
    /** The issues of failed validation. */
    readonly issues: ReadonlyArray<Issue>;
  }
  /** The issue interface of the failure output. */
  interface Issue {
    /** The error message of the issue. */
    readonly message: string;
    /** The path of the issue, if any. */
    readonly path?: ReadonlyArray<PropertyKey | PathSegment> | undefined;
  }
  /** The path segment interface of the issue. */
  interface PathSegment {
    /** The key representing a path segment. */
    readonly key: PropertyKey;
  }
  /** The Standard types interface. */
  interface Types<Input = unknown, Output = Input> extends StandardTypedV1.Types<Input, Output> {}
  /** Infers the input type of a Standard. */
  type InferInput<Schema extends StandardTypedV1> = StandardTypedV1.InferInput<Schema>;
  /** Infers the output type of a Standard. */
  type InferOutput<Schema extends StandardTypedV1> = StandardTypedV1.InferOutput<Schema>;
}
/** Ordered collection of disposable values with O(1) deletion by value. */
declare class DisposableList<T extends WeakKey> {
  private sn;
  private map;
  private weak;
  get length(): number;
  push(value: T): () => boolean;
  delete(value: T): boolean;
  clear(): T[];
  [Symbol.iterator](): MapIterator<T>;
}
/** Shared symbols used to avoid public property-name collisions. */
declare const symbols: {
  shadow: symbol;
  caller: symbol;
  receiver: symbol;
  original: symbol;
  metadata: symbol;
  initHooks: symbol;
  checkProto: symbol;
  effect: typeof Context.effect;
  filter: typeof Context.filter;
  isolate: typeof Context.isolate;
  intercept: typeof Context.intercept;
  init: typeof Service.init;
  check: typeof Service.check;
  config: typeof Service.config;
  invoke: typeof Service.invoke;
  extend: typeof Service.extend;
  tracker: typeof Service.tracker;
  resolveConfig: typeof Service.resolveConfig;
};
/**
 * Service dependency declaration accepted by plugins and the `@Inject`
 * decorator.
 *
 * Array form requests services without intercept config. Object form maps each
 * service name to optional intercept config for the plugin context.
 */
type Inject<M = Dict> = (keyof M)[] | { [K in keyof M]?: M[K]; };
/** Context keys that correspond to services with typed intercept config. */
type InjectKey = keyof { [K in keyof Context & string as Context[K] extends {
  [symbols.config]: any;
} ? K : never]: any; };
/**
 * Decorator for declaring service dependencies on classes or class methods.
 *
 * On classes it contributes to the plugin's static `inject` map. On methods it
 * delays the method call until the declared services are available.
 */
/**
 * @param name — the required service name.
 * @param config — optional intercept config applied for that service.
 * @returns the class or method decorator.
 */
declare function Inject<K extends InjectKey>(name: K, config?: Context[K] extends {
  [symbols.config]: infer T;
} ? T : never): (value: any, decorator: ClassDecoratorContext<any> | ClassMethodDecoratorContext<any>) => void;
/** Utilities for normalizing plugin dependency declarations. */
declare namespace Inject {
  /**
   * Convert array/object/class-inherited inject metadata into a plain map.
   *
   * @param inject — the declaration to normalize; `null`/`undefined` add nothing.
   * @param result — the map to fill (service name → intercept config or `null`).
   * @returns `result`.
   */
  function resolve(inject: Inject | null | undefined, result?: Dict): Dict;
}
/** Supported plugin entrypoint shapes. */
type Plugin<T = any> = Plugin.Function<T> | Plugin.Constructor<T> | Plugin.Object<T>;
/** Types associated with plugin entrypoints and runtime records. */
declare namespace Plugin {
  /** Shared metadata understood by the plugin registry and related tooling. */
  interface Base<T = any> {
    /** Display name used for fiber diagnostics and logger names. */
    name?: string;
    /** Standard-schema validator applied to config before the plugin starts. */
    Config?: StandardSchemaV1<any, T>;
    /** Services the plugin requires; it only loads while all are available. */
    inject?: Inject;
    /** Service name(s) the plugin provides (read by `Service` and by loaders). */
    provide?: string | string[];
    /** Service names whose intercept config the plugin declares it consumes. */
    intercept?: Dict<boolean>;
  }
  interface Transform<S, T> {
    /** Marks the transform object as a schema/config transform. */
    schema?: true;
    /** Convert user-facing config to runtime config. */
    Config: (config: S) => T;
  }
  /** Function plugin called with `(ctx, config)`. */
  interface Function<T = any> extends Base<T> {
    (ctx: Context, config: T): any;
  }
  /** Class plugin constructed with `(ctx, config)`. */
  interface Constructor<T = any> extends Base<T> {
    new (ctx: Context, config: T): any;
  }
  /** Object plugin with an `apply(ctx, config)` method. */
  interface Object<T = any> extends Base<T> {
    apply(ctx: Context, config: T): any;
  }
  /** Mutable registry record shared by all fibers of one plugin callback. */
  interface Runtime {
    /** Display name copied from the first registered plugin shape. */
    name?: string;
    /** Every live fiber of this plugin (one per `ctx.plugin()` call). */
    fibers: DisposableList<Fiber>;
    /** The executable entrypoint all fibers share (registry identity key). */
    callback: globalThis.Function;
    /** Standard-schema validator applied to each fiber's config. */
    Config?: StandardSchemaV1;
  }
}
type Spread<T> = undefined extends T ? [config?: T] : [config: T];
type GetPluginParameters<P> = P extends ((ctx: Context, ...args: infer R) => any) ? R : P extends (new (ctx: Context, ...args: infer R) => any) ? R : P extends {
  apply(ctx: Context, ...args: infer R): any;
} ? R : never;
type GetPluginConfig<P> = P extends Plugin.Transform<infer S, any> ? S : GetPluginParameters<P>[0];
declare module './context.ts' {
  interface Context {
    /**
     * Run a callback once the requested services are available.
     *
     * Shorthand for `ctx.plugin({ inject, apply: callback })`: the callback
     * is unloaded and re-run whenever a required service changes.
     *
     * @param deps — required services, as an array or a name → config map.
     * @param callback — plugin body called with `(ctx, config)`.
     * @returns the fiber; awaiting it settles once loading finished.
     */
    inject(deps: Inject, callback: Plugin.Function<void>): Fiber & PromiseLike<Fiber>;
    /**
     * Load a plugin in the current context.
     *
     * @param plugin — a function, class, or `{ apply }` object plugin.
     * @param args — the plugin config, validated against its `Config` schema.
     * @returns the fiber; awaiting it settles once loading finished
     * (rejecting on config or startup errors).
     */
    plugin<P extends Plugin>(plugin: P, ...args: Spread<GetPluginConfig<P>>): Fiber & PromiseLike<Fiber>;
  }
}
/**
 * Plugin registry installed as `ctx.registry` and mixed into every context.
 *
 * It normalizes plugin shapes, tracks plugin runtimes, starts fibers, and
 * exposes map-like inspection over active plugin callbacks.
 */
declare class RegistryService {
  ctx: Context;
  private _counter;
  private _internal;
  constructor(ctx: Context);
  /** Allocate the next fiber uid (increments on every read). */
  get counter(): number;
  /** Number of registered plugin runtimes. */
  get size(): number;
  /**
   * Resolve a supported plugin shape to its executable callback.
   *
   * @param plugin — a function, class, or `{ apply }` object plugin.
   * @returns the callback identifying the plugin, or `undefined` if invalid.
   */
  resolve(plugin: Plugin): Function | undefined;
  /**
   * Look up the runtime record for a plugin.
   *
   * @param plugin — any supported plugin shape.
   * @returns the runtime, or `undefined` when the plugin is not registered.
   */
  get(plugin: Plugin): Plugin.Runtime | undefined;
  /**
   * Check whether a plugin has a registered runtime.
   *
   * @param plugin — any supported plugin shape.
   * @returns `true` when at least one fiber of the plugin exists.
   */
  has(plugin: Plugin): boolean;
  /**
   * Dispose every running fiber for a plugin and remove its runtime record.
   *
   * @param plugin — any supported plugin shape.
   * @returns the removed runtime, or `undefined` when none was registered.
   */
  delete(plugin: Plugin): Plugin.Runtime | undefined;
  /** Iterate the registered plugin callbacks. */
  keys(): MapIterator<Function>;
  /** Iterate the registered plugin runtimes. */
  values(): MapIterator<Plugin.Runtime>;
  /** Iterate `[callback, runtime]` pairs. */
  entries(): MapIterator<[Function, Plugin.Runtime]>;
  /**
   * Visit every registered runtime.
   *
   * @param callback — receives each runtime and its identifying callback.
   */
  forEach(callback: (value: Plugin.Runtime, key: Function) => void): void;
  /**
   * Start a callback once the requested dependencies are available.
   *
   * @param inject — required services, as an array or a name → config map.
   * @param callback — plugin body called with `(ctx, config)`.
   * @returns the fiber; awaiting it settles once loading finished.
   */
  inject(inject: Inject, callback: Plugin.Function<void>): Fiber & PromiseLike<Fiber>;
  /**
   * Start a plugin in the current context and return its fiber.
   *
   * Creates (or reuses) the plugin's runtime record, then starts a new fiber
   * under the current context. Throws if `plugin` is not a supported shape or
   * if the current fiber is already disposed.
   *
   * @param plugin — a function, class, or `{ apply }` object plugin.
   * @param config — the plugin config, validated against its `Config` schema.
   * @param getOuterStack — captures the caller stack for effect diagnostics.
   * @returns the fiber; awaiting it settles once loading finished.
   */
  plugin(plugin: Plugin, config?: any, getOuterStack?: () => string[]): Fiber & PromiseLike<Fiber>;
}
declare module './context.ts' {
  interface Context {
    /**
     * Read a service from the store without the inject requirement.
     *
     * @param name — the service name.
     * @param strict — when `true` (default), only return implementations
     * whose providing fiber is currently active.
     * @returns the service value, or `undefined` when not (yet) provided.
     */
    get<K extends string & keyof this>(name: K, strict?: boolean): undefined | this[K];
    /** Same as above for service names outside the typed `Context` surface. */
    get(name: string, strict?: boolean): any;
    /**
     * Overwrite a provided service's value.
     *
     * Only the fiber that provided the service may set it; setting an
     * unprovided name throws.
     *
     * @param name — the service name.
     * @param value — the new service value.
     */
    set<K extends string & keyof this>(name: K, value: undefined | this[K]): void;
    /** Same as above for service names outside the typed `Context` surface. */
    set(name: string, value: any): void;
    /**
     * Register a service implementation owned by the current fiber.
     *
     * The service becomes visible to dependents in the same isolation scope
     * once the fiber is active; it is unregistered (waking dependents) when
     * the returned disposer runs or the fiber unloads. Throws if the name is
     * already provided in this scope or declared as an accessor.
     *
     * @param name — the service name.
     * @param value — the service value.
     * @returns a disposer that unregisters the service.
     */
    provide<K extends string & keyof this>(name: K, value: undefined | this[K]): () => void;
    /** Same as above for service names outside the typed `Context` surface. */
    provide(name: string, value?: any): () => void;
    /**
     * Define a computed context property backed by get/set hooks.
     *
     * The accessor is removed when the current fiber unloads. Throws if the
     * name is already declared.
     *
     * @param name — the context property name.
     * @param options — the `get` hook and optional `set` hook.
     */
    accessor(name: string, options: Omit<Property.Accessor, 'type'>): void;
    /**
     * Expose selected members of a service directly on `ctx`.
     *
     * Each mixed-in key becomes an accessor that forwards to the service
     * (binding methods to it), so e.g. `ctx.on` forwards to `ctx.events.on`.
     * Mixins are removed when the current fiber unloads.
     *
     * @param name — the context property holding the source service.
     * @param mixins — keys to forward, or a source-key → ctx-key map.
     */
    mixin<K extends string & keyof this>(name: K, mixins: (keyof this & keyof this[K])[] | Dict<string>): void;
    /** Same as above with a source object instead of a context property name. */
    mixin<T extends {}>(source: T, mixins: (keyof this & keyof T)[] | Dict<string>): void;
  }
}
/** Context property definition known by the reflection service. */
type Property = Property.Service | Property.Accessor;
/** Property definition variants understood by `ReflectService`. */
declare namespace Property {
  /** Service property backed by a provided implementation. */
  interface Service {
    /** Discriminator. */
    type: 'service';
  }
  /** Computed context property backed by custom get/set hooks. */
  interface Accessor {
    /** Discriminator. */
    type: 'accessor';
    /** Compute the property value; `error` carries the caller stack for diagnostics. */
    get: (this: Context, receiver: any, error: Error) => any;
    /** Optional setter; return `false` to reject the write. */
    set?: (this: Context, value: any, receiver: any, error: Error) => boolean;
  }
}
/** Concrete service implementation record stored in the root reflect service. */
interface Impl {
  /** Unique identity of this provision. */
  uid: number;
  /** The service name. */
  name: string;
  /** The providing context, including its service isolation. */
  ctx: Context;
  /** Fibers retaining this implementation until their teardown finishes. */
  dependents: Set<Fiber>;
  /** Wake a provision disposer after its final dependent unloads. */
  release?: () => void;
  /** The current service value. */
  value?: any;
  /** Optional availability predicate consulted before dependents may load. */
  check?: () => boolean;
  isolate: symbol;
}
/**
 * Reflection and service-resolution layer installed as `ctx.reflect`.
 *
 * This service powers the context proxy, service registration, accessors, and
 * the mixins that expose core service methods directly on `ctx`.
 */
declare class ReflectService {
  ctx: Context;
  /** Proxy traps implementing service resolution for every context object. */
  static handler: ProxyHandler<Context>;
  /** Service implementations, keyed by isolation label. */
  store: Dict<Impl, symbol>;
  /** Declared context properties (services and accessors), by name. */
  props: Dict<Property>;
  private _implCounter;
  constructor(ctx: Context);
  /**
   * Read a service from the store without the inject requirement.
   *
   * @param name — the service name.
   * @param strict — when `true`, only return implementations whose providing
   * fiber is currently active.
   * @returns the service value, or `undefined` when not (yet) provided.
   */
  get(name: string, strict?: boolean): any;
  _getImpl(name: string, strict?: boolean): Impl | undefined;
  /**
   * Overwrite a provided service's value.
   *
   * @param name — the service name.
   * @param value — the new service value.
   * @param error — carrier for the caller stack in diagnostics.
   * @returns `true` on success.
   * @throws when `name` was never provided, or was provided by another fiber.
   */
  set(name: string, value: any, error?: Error): boolean;
  /**
   * Register a service implementation owned by the current fiber.
   *
   * See the `ctx.provide()` overload above for the full contract.
   *
   * @param name — the service name.
   * @param value — the service value.
   * @param check — optional availability predicate for dependents.
   * @returns a disposer that unregisters the service.
   */
  provide(name: string, value?: any, check?: () => boolean): Disposable<Promise<void>>;
  /**
   * Re-evaluate every fiber that requires one of the given services.
   *
   * @param names — the service names that changed.
   * @param filter — restricts notification to matching isolation scopes.
   */
  notify(names: string[], filter?: (ctx: Context, name: string) => boolean): void;
  /**
   * Define a computed context property backed by get/set hooks.
   *
   * @param name — the context property name.
   * @param options — the `get` hook and optional `set` hook.
   * @returns a disposer that removes the accessor.
   */
  accessor(name: string, options: Omit<Property.Accessor, 'type'>): Disposable<Promise<void>>;
  /**
   * Expose selected members of a service directly on `ctx`.
   *
   * See the `ctx.mixin()` overload above for the full contract.
   *
   * @param source — a context property name or a source object.
   * @param mixins — keys to forward, or a source-key → ctx-key map.
   * @returns a disposer that removes all created accessors.
   */
  mixin(source: any, mixins: string[] | Dict<string>): Disposable<Promise<void>>;
  /**
   * Attach this context's tracing wrapper to a value.
   *
   * @param value — the value to wrap.
   * @returns the traceable wrapper (or the value itself when not applicable).
   */
  trace<T>(value: T): T;
  /**
   * Wrap a callback so calls trace `this` and arguments to this context.
   *
   * @param callback — the function to wrap.
   * @returns a proxy delegating to `callback` with traced values.
   */
  bind<T extends Function>(callback: T): T;
}
declare module './context.ts' {
  interface Context extends Pick<Fiber, 'effect'> {
    /** The fiber (plugin runtime instance) that owns this context. */
    fiber: Fiber;
  }
}
interface AsyncDisposable<T extends Awaitable<void> = Awaitable<void>> extends PromiseLike<() => T> {
  (): T;
}
/**
 * Function returned by an effect to release resources during disposal.
 *
 * Disposers run in reverse registration order when the owning fiber unloads;
 * they may be async, in which case unloading awaits them.
 */
type Disposable<T = any> = () => T;
/**
 * Effect body result accepted by `ctx.effect()` and plugin startup.
 *
 * Either a single disposer, a promise of one, or a (possibly async) iterable
 * yielding several — generator effects register each yielded disposer as it
 * is produced.
 */
type Effect<T = any> = SyncEffect<T> | AsyncEffect<T>;
type SyncEffect<T = any> = Disposable<T> | Iterable<Disposable<T>, void, void>;
type AsyncEffect<T = any> = Promise<Disposable<T>> | AsyncIterable<Disposable<T>, void, void>;
/** Tree node used to expose nested effect labels for diagnostics. */
interface EffectMeta {
  /** Human-readable effect label, e.g. `ctx.on("event")` or `ctx.provide("name")`. */
  label: string;
  /** Metadata of nested effects registered while this effect ran. */
  children: EffectMeta[];
}
/**
 * Lifecycle state for one plugin fiber.
 *
 * `PENDING` — waiting for required services; `LOADING` — the plugin callback
 * is running; `ACTIVE` — loaded and providing; `FAILED` — the callback or its
 * config threw; `UNLOADING` — disposers are running; `DISPOSED` — the fiber
 * was removed and cannot restart.
 */
declare const enum FiberState {
  PENDING = 0,
  LOADING = 1,
  ACTIVE = 2,
  FAILED = 3,
  DISPOSED = 4,
  UNLOADING = 5
}
/**
 * Runtime instance of one plugin application.
 *
 * A fiber tracks dependency state, raw and effective config, lifecycle effects, and
 * cleanup for the plugin context returned by `ctx.plugin()`.
 */
declare class Fiber {
  parent: Context;
  inject: Dict<any>;
  runtime: Plugin.Runtime | null;
  /** Unique id within the registry; 0 for the root fiber, `null` once disposed. */
  uid: number | null;
  /** The context this fiber's plugin runs in (extends the parent context). */
  readonly ctx: Context;
  /** Raw plugin input retained for the next activation. */
  config: any;
  /** Current lifecycle state; transitions emit `internal/status`. */
  state: FiberState;
  /** Dispose this fiber: unload the plugin, then settle once cleanup finished. */
  readonly dispose: () => Promise<void>;
  /** Required implementations retained through dependent teardown. */
  committed: Readonly<Dict<Impl>> | undefined;
  /** Service implementations owned by this fiber, including isolated provisions. */
  readonly provisions: Set<Impl>;
  /** The in-flight load/unload transition, if one is currently running. */
  inertia: Promise<void> | undefined;
  readonly _hooks: Dict<DisposableList<Function>>;
  readonly _disposables: DisposableList<Disposable<any>>;
  protected context: Context;
  private _error;
  private _revision;
  private _configRevision;
  private _effectiveConfig;
  private _runner;
  private _store;
  private _release;
  /**
   * Create a fiber. Plugin authors normally obtain fibers from `ctx.plugin()`
   * rather than constructing them directly.
   *
   * @param parent — the context the plugin was loaded from.
   * @param config — raw config, validated against the runtime's schema.
   * @param inject — resolved dependency map (service name → intercept config).
   * @param runtime — the shared plugin runtime, or `null` for the root fiber.
   * @param getOuterStack — captures the caller stack for effect diagnostics.
   */
  constructor(parent: Context, config: any, inject: Dict<any>, runtime: Plugin.Runtime | null, getOuterStack: () => string[]);
  /** The plugin's display name, inherited from the nearest named ancestor, else `'root'`. */
  get name(): string;
  /**
   * Throw if the fiber has already been disposed.
   *
   * @returns nothing when the fiber is still active.
   * @throws {CordisError} `INACTIVE_EFFECT` when the fiber's uid has been cleared.
   */
  assertActive(): void;
  private _execute;
  /**
   * Register a cleanup-aware effect on this fiber.
   *
   * `execute` runs immediately; the disposers it produces are collected and
   * run (in reverse order) either when the returned disposer is called or
   * when the fiber unloads, whichever comes first. Calling the disposer twice
   * is a no-op. Throws `CordisError('INACTIVE_EFFECT')` if the fiber is
   * already disposed, and `TypeError` if `execute` returns an invalid shape.
   *
   * @param execute — the effect body; see {@link Effect} for accepted shapes.
   * @param label — effect label shown in `getEffects()` diagnostics.
   * @returns a disposer that tears the effect down and settles once done.
   */
  effect(execute: () => SyncEffect, label?: string): Disposable<Promise<void>>;
  /** Same as above for async effects; the disposer is also awaitable. */
  effect(execute: () => Effect, label?: string): AsyncDisposable<Promise<void>>;
  /**
   * Return metadata for currently registered effects.
   *
   * @returns one {@link EffectMeta} tree per labeled live effect.
   */
  getEffects(): EffectMeta[];
  private _getState;
  private _updateState;
  _checkImpl(name: string): boolean | undefined;
  _refresh(): void;
  private _setEpoch;
  /** Raw input retained for the next activation, without evaluating expressions or validating it. */
  get rawConfig(): unknown;
  /** Retain raw input without changing the running config or triggering an update. */
  set rawConfig(config: unknown);
  /**
   * The object passed to plugin activation or the latest successful update that retained the instance.
   * Candidate resolution does not publish it; volatile updates retain its references.
   * Undefined before activation and readable after unload; callers requiring a live instance check `state`.
   */
  get effectiveConfig(): unknown;
  /**
   * Evaluate and validate a candidate using this fiber's `internal/config` hooks and runtime schema.
   * Does not publish the result, replace raw input, or commit running volatile references.
   * Required injections must be available when a hook uses them.
   * @param config Raw candidate input.
   * @returns The candidate's resolved config, retaining the schema's result identity.
   * @throws {ValidationError} when the runtime schema rejects the candidate; hook errors propagate.
   */
  resolveConfig(config: unknown): unknown;
  private _reload;
  private _unload;
  /**
   * Wait for current lifecycle work and rethrow startup errors.
   *
   * @returns this fiber, once it has settled into a stable state.
   * @throws the config-validation or plugin-startup error, if any.
   */
  await(): Promise<this>;
  /**
   * Dispose and immediately reload this plugin with its current config.
   *
   * @returns a promise resolving once the reload settled.
   * @throws {CordisError} `INACTIVE_EFFECT` when the fiber is already disposed.
   */
  restart(): Promise<void>;
  /**
   * Resolve a candidate, retain its raw config and apply it through the update waterfall.
   * @param config Raw config; pending fibers defer resolution until activation.
   * @param noSave Suppress the persistence notification when true.
   * @returns The awaited update/restart result, or undefined when a synchronous listener handles it.
   * @throws {ValidationError} when an active fiber's candidate is invalid.
   */
  update(config: any, noSave?: boolean): Awaitable<void>;
}
/** Extract the parameter tuple from a function type. */
type Parameters<F> = F extends ((...args: infer P) => any) ? P : never;
/** Extract the return type from a function type. */
type ReturnType$1<F> = F extends ((...args: any) => infer R) ? R : never;
/** Extract the explicit `this` type from a function type. */
type ThisType<F> = F extends ((this: infer T, ...args: any) => any) ? T : never;
/**
 * Event dispatch strategy used by the event service.
 *
 * `emit` runs synchronous listeners without awaiting them, `parallel` awaits
 * all listeners together, `serial` awaits them in order until one bails,
 * `bail` stops on the first synchronous bail value, and `waterfall` composes
 * listeners around a final `next` callback.
 */
type DispatchMode = 'emit' | 'parallel' | 'serial' | 'bail' | 'waterfall';
declare module './context.ts' {
  interface Context {
    /**
     * Dispatch an event, running all listeners concurrently.
     *
     * @param name — the event name.
     * @param args — arguments passed to every listener.
     * @returns a promise resolving once every listener has settled.
     */
    parallel<K extends keyof Events>(name: K, ...args: Parameters<Events[K]>): Promise<void>;
    /** Same as above, with an explicit `this` for listeners (also used for filtering). */
    parallel<K extends keyof Events>(thisArg: NoInfer<ThisType<Events[K]>>, name: K, ...args: Parameters<Events[K]>): Promise<void>;
    /**
     * Dispatch an event synchronously, ignoring listener return values.
     *
     * @param name — the event name.
     * @param args — arguments passed to every listener.
     */
    emit<K extends keyof Events>(name: K, ...args: Parameters<Events[K]>): void;
    /** Same as above, with an explicit `this` for listeners (also used for filtering). */
    emit<K extends keyof Events>(thisArg: NoInfer<ThisType<Events[K]>>, name: K, ...args: Parameters<Events[K]>): void;
    /**
     * Dispatch an event, awaiting listeners in order until one bails.
     *
     * @param name — the event name.
     * @param args — arguments passed to each listener.
     * @returns the first bail value (non-null, non-false, non-undefined), if any.
     */
    serial<K extends keyof Events>(name: K, ...args: Parameters<Events[K]>): Promisify<ReturnType$1<Events[K]>>;
    /** Same as above, with an explicit `this` for listeners (also used for filtering). */
    serial<K extends keyof Events>(thisArg: NoInfer<ThisType<Events[K]>>, name: K, ...args: Parameters<Events[K]>): Promisify<ReturnType$1<Events[K]>>;
    /**
     * Dispatch an event, calling listeners in order until one bails.
     *
     * @param name — the event name.
     * @param args — arguments passed to each listener.
     * @returns the first bail value (non-null, non-false, non-undefined), if any.
     */
    bail<K extends keyof Events>(name: K, ...args: Parameters<Events[K]>): ReturnType$1<Events[K]>;
    /** Same as above, with an explicit `this` for listeners (also used for filtering). */
    bail<K extends keyof Events>(thisArg: NoInfer<ThisType<Events[K]>>, name: K, ...args: Parameters<Events[K]>): ReturnType$1<Events[K]>;
    /**
     * Dispatch an event whose last argument is a `next` continuation.
     *
     * Each listener wraps the rest of the chain: calling `next()` invokes the
     * next listener (finally the built-in behavior); not calling it vetoes.
     *
     * @param name — the event name.
     * @param args — listener arguments; the final one is the innermost `next`.
     * @returns the outermost listener's return value.
     */
    waterfall<K extends keyof Events>(name: K, ...args: Parameters<Events[K]>): ReturnType$1<Events[K]>;
    /** Same as above, with an explicit `this` for listeners (also used for filtering). */
    waterfall<K extends keyof Events>(thisArg: NoInfer<ThisType<Events[K]>>, name: K, ...args: Parameters<Events[K]>): ReturnType$1<Events[K]>;
    /**
     * Register an event listener owned by the current fiber.
     *
     * @param name — the event name to listen for.
     * @param listener — called with the dispatch arguments.
     * @param options — listener options; a boolean is shorthand for `prepend`.
     * @returns a disposer removing the listener; `true` if it was still registered.
     */
    on<K extends keyof Events>(name: K, listener: Events[K], options?: boolean | EventOptions): () => boolean;
    /**
     * Same as `on()`, but the listener disposes itself after its first call.
     *
     * @param name — the event name to listen for.
     * @param listener — called at most once with the dispatch arguments.
     * @param options — listener options; a boolean is shorthand for `prepend`.
     * @returns a disposer removing the listener; `true` if it was still registered.
     */
    once<K extends keyof Events>(name: K, listener: Events[K], options?: boolean | EventOptions): () => boolean;
  }
}
/** Options accepted by `ctx.on()` and `ctx.once()`. */
interface EventOptions {
  /** Add the listener before existing listeners for the same event. */
  prepend?: boolean;
  /** Receive the event regardless of context filter checks. */
  global?: boolean;
}
/** Registered listener record stored by the event service. */
interface Hook extends EventOptions {
  ctx: Context;
  callback: (...args: any[]) => any;
}
/**
 * Event bus installed as `ctx.events` and mixed into every context.
 *
 * The service supports concurrent, synchronous, serial, bail, and waterfall
 * dispatch and automatically disposes listeners with their owning fiber.
 */
declare class EventsService {
  private ctx;
  _hooks: Record<keyof any, Hook[]>;
  constructor(ctx: Context);
  private _resolve;
  /**
   * Resolve bound callbacks using the event's context filter.
   * @param type Dispatch mode reported to observers.
   * @param args Dispatch arguments, consumed through the event name.
   * @returns Matching callbacks bound to the dispatch receiver.
   * DSH retains callback enumeration for per-listener error containment.
   */
  dispatch(type: string, args: any[]): ((...args: any[]) => any)[];
  /**
   * Run listeners concurrently and wait for all of them.
   *
   * @param args — optional `this`, the event name, then listener arguments.
   * @returns a promise resolving once every listener has settled.
   */
  parallel(...args: any[]): Promise<void>;
  /**
   * Run listeners synchronously without waiting for returned promises.
   *
   * @param args — optional `this`, the event name, then listener arguments.
   */
  emit(...args: any[]): void;
  /**
   * Run listeners in order, awaiting each, until one returns a bail value.
   *
   * @param args — optional `this`, the event name, then listener arguments.
   * @returns the first bail value (see {@link isBailed}), if any.
   */
  serial(...args: any[]): Promise<any>;
  /**
   * Run listeners synchronously until one returns a bail value.
   *
   * @param args — optional `this`, the event name, then listener arguments.
   * @returns the first bail value (see {@link isBailed}), if any.
   */
  bail(...args: any[]): any;
  /**
   * Compose listeners around the final `next` callback.
   *
   * The last dispatch argument is treated as the innermost `next`. Listeners
   * run outermost-first; a listener that does not call `next()` vetoes the
   * rest of the chain, including the built-in behavior.
   *
   * @param args — optional `this`, the event name, listener arguments, then `next`.
   * @returns the outermost listener's return value.
   */
  waterfall(...args: any[]): any;
  private register;
  private unregister;
  /**
   * Register an event listener owned by the current fiber.
   *
   * The listener is removed automatically when the fiber unloads. Throws
   * `CordisError('INACTIVE_EFFECT')` if the fiber is already disposed.
   *
   * @param name — the event name to listen for.
   * @param listener — called with the dispatch arguments.
   * @param options — listener options; a boolean is shorthand for `prepend`.
   * @returns a disposer removing the listener; `true` if it was still registered.
   */
  on(name: string | symbol, listener: (...args: any) => any, options?: boolean | EventOptions): any;
  /**
   * Register an event listener that disposes itself after the first call.
   *
   * @param name — the event name to listen for.
   * @param listener — called at most once with the dispatch arguments.
   * @param options — listener options; a boolean is shorthand for `prepend`.
   * @returns a disposer removing the listener; `true` if it was still registered.
   */
  once(name: string | symbol, listener: (...args: any) => any, options?: boolean | EventOptions): any;
}
/**
 * Built-in framework events used by core services and extension points.
 *
 * Plugin and status events track fiber lifecycle, service events observe
 * dependency registration, update/get/set/listener events allow core services
 * to intercept runtime operations, and `internal/dispatch` exposes event-bus
 * diagnostics before public events are delivered.
 */
interface Events {
  [key: symbol]: (...args: any[]) => any;
  /** A plugin fiber was created or its uid was cleared on disposal. */
  'internal/plugin'(fiber: Fiber): void;
  /** A fiber changed lifecycle state; receives the fiber and its previous state. */
  'internal/status'(fiber: Fiber, oldValue: FiberState): void;
  /** A service binding was refreshed in the matching isolation scope. */
  'internal/service'(this: Context, name: string, value: any): void;
  /**
   * Apply resolved config; omitting `next()` keeps the current instance.
   * @param resolvedConfig - the evaluated and validated candidate.
   * @param next - restarts the fiber and waits for its lifecycle work.
   * @mode waterfall
   */
  'internal/update'(this: Fiber, resolvedConfig: any, next: () => Awaitable<void>): Awaitable<void>;
  /**
   * Persist original config from a programmatic update, before its lifecycle transition.
   * @param fiber - the updated fiber.
   * @param originalConfig - the raw candidate; omitted when update uses noSave.
   * @mode emit
   */
  'internal/commit'(fiber: Fiber, originalConfig: any): void;
  /**
   * Resolve plugin config after injections are active; candidate resolution does not publish it.
   * @param fiber - the fiber whose candidate is being resolved.
   * @param next - obtains the raw candidate from inner listeners.
   * @mode waterfall
   */
  'internal/config'(fiber: Fiber, next: () => any): any;
  /** Waterfall: a service is being read through the context proxy. */
  'internal/get'(ctx: Context, name: string, error: Error, next: () => any): any;
  /** Waterfall: a service is being written through the context proxy. */
  'internal/set'(ctx: Context, name: string, value: any, error: Error, next: () => boolean): boolean;
  /** Bail: a listener is being registered; a non-null result replaces registration. */
  'internal/listener'(this: Context, name: string, listener: any, prepend: boolean): void;
  /** An event is being dispatched to listeners (fired for non-internal events only). */
  'internal/dispatch'(mode: DispatchMode, name: string | symbol, args: any[], thisArg: any): void;
}
declare module './context.ts' {
  interface Intercept {
    logger: LoggerService.Intercept;
  }
}
/** Logger method name and severity category. */
type LoggerType = 'error' | 'info' | 'warn' | 'debug';
/** Callable shape for one logger severity method. */
type LoggerMethod = (format: any, ...param: any[]) => void;
/** Formatter used to resolve a printf-style placeholder. */
type Formatter = (value: any, exporter: Exporter, message: Message) => any;
/** Structured log record delivered to exporters. */
interface Message {
  sn: number;
  ts: number;
  name: string;
  type: LoggerType;
  level: number;
  args: any[];
  fiber?: WeakRef<Fiber>;
}
/** Sink that receives structured log messages. */
interface Exporter {
  colors?: number | false;
  maxLength?: number;
  levels?: Record<string, number>;
  formatters?: Record<string, Formatter>;
  export(message: Message): void;
}
/** Options used when creating a named logger facade. */
interface LoggerOptions {
  /** The logger name shown with each message. */
  name: string;
  /** Message fields merged into every record from this logger. */
  meta?: Partial<Message>;
  /** Default maximum level exported when an exporter has no own threshold. */
  level?: number;
}
/** Logger facade identity, inherited message metadata, and optional minimum level. */
interface Logger extends LoggerOptions {}
/** Logger facade severity methods. */
interface Logger extends Record<LoggerType, LoggerMethod> {}
/** Logger facade for one named subsystem. */
declare class Logger {
  private service;
  static color(exporter: Exporter, code: number, value: any, decoration?: string): string;
  static code(name: string, level?: false | number): number;
  static format(exporter: Exporter, message: Message): string;
  constructor(options: LoggerOptions, service: LoggerService);
  private _method;
}
/** Logger service configuration merged from context intercepts. */
declare namespace LoggerService {
  interface Intercept {
    name?: string;
    level?: number;
  }
}
/** Callable `ctx.logger` service shape. */
interface LoggerService extends Record<LoggerType, LoggerMethod> {
  (name?: string): Logger;
}
/**
 * Built-in logging service.
 *
 * Call `ctx.logger()` to create a named logger, or call `ctx.logger.info()`
 * directly to log with the current fiber-derived name.
 */
declare class LoggerService {
  bufferSize: number;
  buffer: Message[];
  ctx: Context;
  _snMessage: number;
  _snExporter: number;
  exporters: Map<number, Exporter>;
  constructor(ctx: Context);
  /**
   * Register an exporter and dispose it with the current fiber.
   *
   * @param exporter — the sink that receives structured log messages.
   * @returns a disposer that removes the exporter.
   */
  exporter(exporter: Exporter): Disposable<Promise<void>>;
  private _resolveConfig;
  [symbols.invoke](name?: string): Logger;
}
/**
 * Public shape of a Cordis context.
 *
 * The concrete `Context` class is proxied at runtime, so this interface is
 * augmented by core services and plugins to describe the properties that may
 * be read from `ctx`.
 */
interface Context {
  /** Isolation map: service name → scope label. Lookups for a name resolve within its label. */
  [symbols.isolate]: Dict<symbol>;
  /** Intercept map: service name → config merged into that service's per-plugin config. */
  [symbols.intercept]: Dict;
  /** The root context of the application (every child context shares it). @experimental */
  root: this;
  /** Base URL used to resolve relative plugin/module specifiers, if the runtime sets one. */
  baseUrl?: string | undefined;
  /** The event bus. Its methods are also mixed onto `ctx` (`ctx.on`, `ctx.emit`, ...). */
  events: EventsService;
  /** The logging service. Call `ctx.logger(name)` for a named logger. */
  logger: LoggerService;
  /** The reflection layer backing the context proxy (`ctx.get`, `ctx.provide`, ...). */
  reflect: ReflectService;
  /** The plugin registry. Its methods are mixed onto `ctx` (`ctx.plugin`, `ctx.inject`). */
  registry: RegistryService;
}
/**
 * Root and child dependency containers for Cordis plugins.
 *
 * A context is a proxy: normal property reads go through the service resolver,
 * while `extend()`, `isolate()`, and `intercept()` create scoped child
 * contexts without mutating their parent.
 */
declare class Context {
  /** Symbol key under which a disposer exposes its {@link EffectMeta} diagnostics tree. */
  static readonly effect: unique symbol;
  /** Symbol key for a context's listener filter, consulted on every event dispatch. */
  static readonly filter: unique symbol;
  /** Symbol key of the isolation map (see the `Context[symbols.isolate]` property). */
  static readonly isolate: unique symbol;
  /** Symbol key of the intercept map (see the `Context[symbols.intercept]` property). */
  static readonly intercept: unique symbol;
  /**
   * Returns true for Cordis context proxies and context prototypes.
   *
   * Works across realms and across multiple copies of cordis, because the
   * brand is keyed by a global symbol rather than by `instanceof`.
   *
   * @param value — the value to test.
   * @returns `true` if `value` is a Cordis context, narrowing its type.
   */
  static is(value: any): value is Context;
  /** Create the root context and install the built-in services. */
  constructor();
  /**
   * Create a child context with extra metadata on top of the current scope.
   *
   * The child prototypally inherits every property of this context; own
   * properties of `meta` shadow the inherited ones. The parent is not mutated.
   *
   * @param meta — own properties (including symbol keys) to define on the child.
   * @returns a child context inheriting from this one.
   */
  extend(meta?: {}): this;
  /**
   * Create a child context with an independent service scope for `name`.
   *
   * Below the returned context, reads and writes of the service `name`
   * resolve against the new label instead of the parent's, so a different
   * implementation can be provided without affecting the parent scope.
   * Passing the same `label` to two `isolate()` calls joins their scopes.
   *
   * @param name — the service name to isolate.
   * @param label — scope label to join; defaults to a fresh unique symbol.
   * @returns a child context whose `name` service resolves in the new scope.
   */
  isolate(name: string, label?: symbol): this;
  /**
   * Add service-specific intercept config for plugins started below this
   * context.
   *
   * Plugins loaded under the returned context see `config` merged into the
   * service's resolved config (ancestor entries first; see
   * `Service[symbols.resolveConfig]`). The parent context is not affected.
   *
   * @param name — the service name whose config to intercept.
   * @param config — the intercept config to merge for that service.
   * @returns a child context carrying the additional intercept entry.
   */
  intercept<K extends InjectKey>(name: K, config: Context[K] extends {
    [symbols.config]: infer T;
  } ? T : never): this;
  intercept(name: string, config: any): this;
}
/**
 * Base class for services that expose a named API on `ctx`.
 *
 * Subclasses call `super(ctx, name)` from their constructor. The service is
 * registered immediately and is automatically removed with the owning fiber.
 */
declare abstract class Service<out T = never> {
  protected ctx: Context;
  /** Symbol key of an instance method run after construction (class plugins). */
  static readonly init: unique symbol;
  /** Symbol key of the availability predicate passed to `ctx.provide()`. */
  static readonly check: unique symbol;
  /** Symbol key of the phantom intercept-config type parameter. */
  static readonly config: unique symbol;
  /** Symbol key of the call body making a service callable (e.g. `ctx.logger()`). */
  static readonly invoke: unique symbol;
  /** Symbol key of the helper deriving an extended service instance. */
  static readonly extend: unique symbol;
  /** Symbol key of the tracker metadata used for context tracing. */
  static readonly tracker: unique symbol;
  /** Symbol key of the intercept-config resolution helper below. */
  static readonly resolveConfig: unique symbol;
  [symbols.config]: T;
  /** The service name this instance is registered under. */
  name: string;
  /**
   * Register this instance as `name` in the current context.
   *
   * Calls `ctx.reflect.provide(name, this, this[Service.check])`, so the
   * service is unregistered automatically when the owning fiber unloads.
   * Services with a `[Service.invoke]` body return a callable instance.
   *
   * @param ctx — the context to register in (stored as `this.ctx`).
   * @param name — the service name; defaults to the static `provide` field.
   */
  constructor(ctx: Context, name: string);
  protected [symbols.filter](ctx: Context): boolean;
  protected [symbols.extend](props?: any): any;
  /**
   * Merge intercept config from ancestors with optional base and head values.
   *
   * Entries added closer to the root apply first; `base` is prepended and
   * `head` appended. Uses `Config.merge` when the service declares one,
   * otherwise a shallow `Object.assign`.
   *
   * @param base — lowest-precedence config merged before all intercepts.
   * @param head — highest-precedence config merged after all intercepts.
   * @returns the merged config.
   */
  [symbols.resolveConfig](base?: T, head?: T): T;
  static [Symbol.hasInstance](instance: any): boolean;
}
declare const kSchema: unique symbol;
declare global {
  namespace Schemastery {
    /** Convert primitive constructors, constants, and existing schemas into a schema type. */
    type From<X> = X extends string | number | boolean ? Schema<X> : X extends Schema<any, any, SchemaMode> ? X : X extends typeof String ? Schema<string> : X extends typeof Number ? Schema<number> : X extends typeof Boolean ? Schema<boolean> : X extends typeof Function ? Schema<Function, (...args: any[]) => any> : X extends Constructor<infer S> ? Schema<S> : never;
    type TypeS1<X> = X extends Schema<infer S, infer _T, infer _M> ? S : never;
    type Inverse<X> = X extends Schema<infer _S, infer T, infer M> ? (arg: SchemaOutput<T, M>) => void : never;
    /** Input type accepted by a schema-like value. */
    type TypeS<X> = TypeS1<From<X>>;
    /** Output type returned by a schema-like value after validation. */
    type TypeT<X> = ReturnType<From<X>>;
    /** Resolver callback used by custom schema types registered with `Schema.extend()`. */
    type Resolve = (data: any, schema: Schema, options: Options, strict?: boolean) => [any, any?];
    /** Input type accepted by one schema in an intersection. */
    type IntersectS<X> = From<X> extends Schema<infer S, infer _T, infer _M> ? S : never;
    /** Output type returned by one schema in an intersection. */
    type IntersectT<X> = Inverse<From<X>> extends ((arg: infer T) => void) ? T : never;
    type TupleS<X extends readonly any[]> = X extends readonly [infer L, ...infer R] ? [TypeS<L>?, ...TupleS<R>] : any[];
    type TupleT<X extends readonly any[]> = X extends readonly [infer L, ...infer R] ? [TypeT<L>?, ...TupleT<R>] : any[];
    type ObjectS<X extends Dict> = { [K in keyof X]?: TypeS<X[K]> | null; } & Dict;
    type ObjectT<X extends Dict> = { [K in keyof X]: TypeT<X[K]>; } & Dict;
    type Constructor<T = any> = new (...args: any[]) => T;
    /** Static constructor and factory methods exposed by the default `Schema` export. */
    interface Static {
      <T = any>(options: Partial<Schema<T>>): Schema<T>;
      new <T = any>(options: Partial<Schema<T>>): Schema<T>;
      prototype: Schema;
      /** Validate a value against a schema node and return `[output, adaptedInput?]`. */
      resolve: Resolve;
      /** Infer a schema from a primitive value, constructor, or existing schema. */
      from<X = any>(source?: X): From<X>;
      /** Register a resolver for a custom schema `type`. */
      extend(type: string, resolve: Resolve): void;
      /** Accept any value without validation. */
      any<T = any>(): Schema<T>;
      /** Accept only nullable input. */
      never(): Schema<never>;
      /** Accept exactly one constant value. */
      const<const T>(value: T): Schema<T>;
      /** Accept strings, with optional metadata constraints added by instance methods. */
      string(): Schema<string>;
      /** Accept numbers, with optional range and step constraints. */
      number(): Schema<number>;
      /** Accept non-negative integer numbers. */
      natural(): Schema<number>;
      /** Accept a number between 0 and 1 and mark it as a slider. */
      percent(): Schema<number>;
      /** Accept booleans. */
      boolean(): Schema<boolean>;
      /** Accept `Date` instances or parse datetime strings into `Date` objects. */
      date(): Schema<string | Date, Date>;
      /** Accept `RegExp` instances or parse strings into regular expressions. */
      regExp(flag?: string): Schema<string | RegExp, RegExp>;
      /** Accept binary sources and normalize them to `ArrayBufferLike`. */
      arrayBuffer(): Schema<Binary.Source, ArrayBufferLike>;
      arrayBuffer(encoding: 'hex' | 'base64'): Schema<Binary.Source | string, ArrayBufferLike>;
      /** Accept a numeric bitset or string keys and normalize to a number. */
      bitset<K extends string>(bits: Partial<Record<K, number>>): Schema<number | readonly K[], number>;
      /** Accept functions. */
      function(): Schema<Function, (...args: any[]) => any>;
      /** Accept instances of a constructor or objects whose constructor name matches. */
      is(constructor: string): Schema;
      is<T>(constructor: Constructor<T>): Schema<T>;
      /** Accept arrays whose elements match `inner`. */
      array<X>(inner: X): Schema<TypeS<X>[], TypeT<X>[]>;
      /** Accept plain objects with values matching `inner` and optional key schema. */
      dict<X, Y extends Schema<any, string> = Schema<string>>(inner: X, sKey?: Y): Schema<Dict<TypeS<X>, TypeS<Y>>, Dict<TypeT<X>, TypeT<Y>>>;
      /** Accept tuple arrays where each index matches the corresponding schema. */
      tuple<const X extends readonly any[]>(list: X): Schema<TupleS<X>, TupleT<X>>;
      /** Accept plain objects; infer fields from the dictionary, not the enclosing schema's output type. */
      object<X extends Dict>(dict: X): Schema<ObjectS<NoInfer<X>>, ObjectT<NoInfer<X>>>;
      /** Accept values matching at least one schema in `list`. */
      union<const X>(list: readonly X[]): Schema<TypeS<X>, TypeT<X>>;
      /** Accept values matching every schema in `list`, merging object outputs. */
      intersect<const X>(list: readonly X[]): Schema<IntersectS<X>, IntersectT<X>>;
      /** Validate with `inner`, then convert the result with `callback`. */
      transform<X, T>(inner: X, callback: (value: TypeS<X>, options: Schemastery.Options) => T, preserve?: boolean): Schema<TypeS<X>, T>;
      /** Defer construction of a recursive schema until validation or serialization. */
      lazy<X extends Schema<any, any, SchemaMode>>(callback: () => X): X;
      ValidationError: typeof ValidationError;
    }
    /** Runtime validation options shared by all schema calls. */
    interface Options {
      /** Remove invalid object properties instead of throwing when possible. */
      autofix?: boolean;
      /** Skip validation for selected values and schema nodes. */
      ignore?(data: any, schema: Schema): boolean;
      /** Path used to format nested validation errors. */
      path?: (keyof any)[];
    }
    /** UI and validation metadata attached by schema builder methods. */
    interface Meta<T = any> {
      default?: T extends {} ? Partial<T> : T;
      required?: boolean;
      /** Parse this node as a stable config reference; its type and UI metadata remain unchanged. */
      volatile?: boolean;
      disabled?: boolean;
      collapse?: boolean;
      badges?: {
        text: string;
        type: string;
      }[];
      hidden?: boolean;
      loose?: boolean;
      role?: string;
      extra?: any;
      link?: string;
      description?: string | Dict<string>;
      comment?: string;
      pattern?: {
        source: string;
        flags?: string;
      };
      max?: number;
      min?: number;
      step?: number;
    }
  }
  /** Callable schema instance that validates input and returns normalized output. */
  interface Schemastery<S = any, T = S, Mode extends SchemaMode = 'plain'> {
    (data?: S | null, options?: Schemastery.Options): SchemaOutput<T, Mode>;
    new (data?: S | null, options?: Schemastery.Options): SchemaOutput<T, Mode>;
    [kSchema]: true;
    uid: number;
    meta: Schemastery.Meta<T>;
    type: string;
    sKey?: Schema;
    inner?: Schema;
    list?: Schema[];
    dict?: Dict<Schema>;
    bits?: Dict<number>;
    callback?: Function;
    constructor?: string | Function;
    builder?: Function;
    value?: T;
    refs?: Dict<Schema>;
    preserve?: boolean;
    '~standard': StandardSchemaV1.Props;
    /** Format this schema as a compact TypeScript-like type string. */
    toString(inline?: boolean): string;
    /** Serialize this schema, preserving shared and recursive references. */
    toJSON(): Schema<S, T, Mode>;
    /** Mark nullable input as invalid unless a default supplies a fallback. */
    required<R extends boolean = true>(value?: R): Schema<S, T, SetRequired<Mode, R>>;
    /**
     * Parse this config field as a stable reference containing immutable data.
     * @returns a schema whose output supports get(), including when the field is absent.
     */
    volatile(): Schema<NoInfer<S>, NoInfer<T>, Mode extends 'defined' | 'volatile-defined' ? 'volatile-defined' : 'volatile'>;
    /** Hide this schema node from UI renderers. */
    hidden(value?: boolean): Schema<S, T, Mode>;
    /** Return the default value instead of throwing when validation fails. */
    loose(value?: boolean): Schema<S, T, Mode>;
    /** Attach a renderer role and optional role-specific metadata. */
    role(text: string, extra?: any): Schema<S, T, Mode>;
    /** Attach an external documentation link. */
    link(link: string): Schema<S, T, Mode>;
    /** Set the fallback value used for nullable input. */
    default(value: T | NoInfer<Partial<S>>): Schema<S, T, SetRequired<Mode, true>>;
    /** Attach an auxiliary comment for documentation or form UIs. */
    comment(text: string): Schema<S, T, Mode>;
    /** Attach a localized or plain description for documentation or form UIs. */
    description(text: string): Schema<S, T, Mode>;
    /** Mark this schema node as disabled for form UIs. */
    disabled(value?: boolean): Schema<S, T, Mode>;
    /** Request collapsed rendering for nested form UIs. */
    collapse(value?: boolean): Schema<S, T, Mode>;
    /** Add a deprecated badge to this schema node. */
    deprecated(): Schema<S, T, Mode>;
    /** Add an experimental badge to this schema node. */
    experimental(): Schema<S, T, Mode>;
    /** Require strings to match a regular expression. */
    pattern(regexp: RegExp): Schema<S, T, Mode>;
    /** Set an inclusive maximum for numbers or collection lengths. */
    max(value: number): Schema<S, T, Mode>;
    /** Set an inclusive minimum for numbers or collection lengths. */
    min(value: number): Schema<S, T, Mode>;
    /** Set the numeric increment constraint. */
    step(value: number): Schema<S, T, Mode>;
    /** Add or replace an object property schema. */
    set(key: string, value: Schema): Schema<S, T, Mode>;
    /** Append a tuple, union, or intersection member schema. */
    push(value: Schema): Schema<S, T, Mode>;
    /** Remove values equal to schema defaults from normalized output. */
    simplify(value?: any): any;
    /** Return a schema clone with descriptions merged from locale messages. */
    i18n(messages: Dict): Schema<S, T, Mode>;
    /** Attach arbitrary metadata consumed by form renderers and downstream tools. */
    extra<K extends keyof Schemastery.Meta>(key: K, value: Schemastery.Meta[K]): Schema<S, T, Mode>;
  }
}
declare class ValidationError extends TypeError {
  options: Schemastery.Options;
  name: string;
  constructor(message: string, options: Schemastery.Options);
  static is(error: any): error is ValidationError;
}
type SchemaMode = 'plain' | 'defined' | 'volatile' | 'volatile-defined';
type SchemaOutput<T, M extends SchemaMode> = M extends 'volatile' ? Volatile<T | undefined> : M extends 'volatile-defined' ? Volatile<T> : T;
type SetRequired<M extends SchemaMode, R extends boolean> = M extends 'volatile' | 'volatile-defined' ? R extends true ? 'volatile-defined' : 'volatile' : R extends true ? 'defined' : 'plain';
type Schema<S = any, T = S, Mode extends SchemaMode = 'plain'> = Schemastery<S, T, Mode>;
declare const Schema: Schemastery.Static;
export declare const name = "memory-handoff";
export interface Config {
  /** handoff 文件位置（JSON）。默认 $DSH_HOME/memory-handoff.json */
  storePath: string;
  /** 一轮最多提示几条未完成事项 */
  maxHints: number;
  /** 压缩存盘时是否记录被压缩掉的区间 */
  recordShadowedRange: boolean;
}
export declare const Config: Schema<Schemastery.ObjectS<NoInfer<{
  storePath: Schema<string, string, "defined">;
  maxHints: Schema<number, number, "defined">;
  recordShadowedRange: Schema<boolean, boolean, "defined">;
}>>, Schemastery.ObjectT<NoInfer<{
  storePath: Schema<string, string, "defined">;
  maxHints: Schema<number, number, "defined">;
  recordShadowedRange: Schema<boolean, boolean, "defined">;
}>>, "plain">;
type Status = 'pending' | 'done' | 'dropped';
export interface Item {
  id: string;
  title: string;
  status: Status;
  did?: string;
  next?: string;
  updatedAt: string;
}
export interface Store {
  version: 1;
  items: Item[];
  lastCompaction?: {
    at: string;
    compactionId: string;
    turn: number | null;
    summary: string;
    shadowed?: {
      start: number;
      end: number;
    };
  };
}
export declare function emptyStore(): Store;
export declare function readStore(p: string): Store;
export declare function writeStore(p: string, s: Store): void;
/** 只把 pending 压成一行；done / dropped 永远不出现。 */
export declare function hintLine(s: Store, max: number): string;
export declare function apply(ctx: Context, config: Config): void;
export {};