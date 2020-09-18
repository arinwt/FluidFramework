/*!
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { IsomorphicPerformance } from "./performanceIsomorphic";

export const performance: IsomorphicPerformance = window.performance;

// back-compat
export function performanceNow() {
    return performance.now();
}
