/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

export const eventThis = Symbol("eventThis");
export type EventThis = typeof eventThis;

export type EventArgs<T, TThis> =
    T extends any[] ? { [K in keyof T]: T[K] extends EventThis ? TThis : T[K] } : T;

export type EventName<
    TEvents,
    TKey extends keyof TEvents = keyof TEvents
> = TKey extends string | number ? TKey : never;

export type EventHandler<
    TEvents,
    TThis,
    TKey extends keyof TEvents = keyof TEvents,
    TArgs extends TEvents[TKey] = TEvents[TKey]
> = (...args: EventArgs<TArgs, TThis>) => void;

export type EventSubscribe<TEvents, TThis> = <
    TKey extends keyof TEvents = keyof TEvents,
    TArgs extends TEvents[TKey] = TEvents[TKey]
>(
    event: EventName<TEvents, TKey>,
    listener: EventHandler<TEvents, TThis, TKey, TArgs>,
) => TThis;

export interface IErrorEvents {
    error: [error: any];
}

export interface IEventProvider<TEvents> {
    readonly on: EventSubscribe<TEvents, this>;
    readonly off: EventSubscribe<TEvents, this>;
    readonly once: EventSubscribe<TEvents, this>;
    readonly addListener: EventSubscribe<TEvents, this>;
    readonly removeListener: EventSubscribe<TEvents, this>;
    readonly prependListener: EventSubscribe<TEvents, this>;
    readonly prependOnceListener: EventSubscribe<TEvents, this>;
}
