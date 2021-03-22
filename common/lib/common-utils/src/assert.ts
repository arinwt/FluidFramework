/*!
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

/**
 * A browser friendly version of the node assert library. Use this instead of the 'assert' package, which has a big
 * impact on bundle sizes.
 * @param condition - The condition that should be true, if the condition is false an error will be thrown.
 * @param message - The message to include in the error when the condition does not hold.
 *  A number should not be specificed manually. Run policy-check to get shortcode number assigned.
 */
 export function assert(condition: boolean, message: string | number): asserts condition {
     if (!condition) {
         throw new Error(typeof message === "number" ? message.toString(16) : message);
     }
 }
