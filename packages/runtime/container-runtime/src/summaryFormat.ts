/*!
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { SummaryType } from "@fluidframework/protocol-definitions";
import { channelsTreeName, ISummaryTreeWithStats } from "@fluidframework/runtime-definitions";
import { IFluidDataStoreAttributes } from "./dataStoreContext";

export type ContainerRuntimeSummaryFormatVersion =
    /**
     * Version 0: format version is missing from summary.
     * This indicates it is an older version.
     */
    | undefined
    /**
     * Introduces .metadata blob and .channels trees for isolation of
     * data store trees from container-level objects.
     */
    | 1;

export type DataStoreSummaryFormatVersion =
    /**
     * Version 0: format version is missing from summary.
     * This indicates it is an older version.
     */
    | undefined
    /**
     * Version 1: from this version the pkg within the data store
     * attributes blob is a JSON array rather than a string.
     */
    | "0.1"
    /**
     * Introduces .channels trees for isolation of
     * channel trees from data store objects.
     */
    | 2;

export function summaryFormatVersionToNumber(
    version: ContainerRuntimeSummaryFormatVersion | DataStoreSummaryFormatVersion,
): number {
    if (version === undefined) {
        return 0;
    }
    if (version === "0.1") {
        return 1;
    }
    return version;
}

export const metadataBlobName = ".metadata";
export const chunksBlobName = ".chunks";
export const blobsTreeName = ".blobs";

export interface IContainerRuntimeMetadata {
    readonly summaryFormatVersion: ContainerRuntimeSummaryFormatVersion;
    /** True if channels are not isolated in .channels subtrees, otherwise isolated. */
    readonly disableIsolatedChannels?: true;
}

export function rootHasIsolatedChannels(metadata: IContainerRuntimeMetadata | undefined): boolean {
    const version = summaryFormatVersionToNumber(metadata?.summaryFormatVersion);
    return version >= 1 && !metadata?.disableIsolatedChannels;
}

export function hasIsolatedChannels(attributes: IFluidDataStoreAttributes | undefined): boolean {
    const version = summaryFormatVersionToNumber(attributes?.snapshotFormatVersion);
    return version >= 2 && !attributes?.disableIsolatedChannels;
}

export const protocolTreeName = ".protocol";

/**
 * List of tree IDs at the container level which are reserved.
 * This is for older versions of summaries that do not yet have an
 * isolated data stores namespace. Without the namespace, this must
 * be used to prevent name collisions with data store IDs.
 */
export const nonDataStorePaths = [protocolTreeName, ".logTail", ".serviceProtocol", blobsTreeName];

export const dataStoreAttributesBlobName = ".component";

/**
 * Modifies summary tree and stats to put tree under .channels tree.
 * Converts from: {
 *     type: SummaryType.Tree,
 *     tree: { a: {...}, b: {...}, c: {...} },
 * }
 * to: {
 *     type: SummaryType.Tree,
 *     tree: {
 *         ".channels": {
 *             type: SummaryType.Tree,
 *             tree: { a: {...}, b: {...}, c: {...} }
 *         },
 *     },
 * }
 * And adds +1 to treeNodeCount in stats.
 * @param summarizeResult - summary tree and stats to modify
 */
export function wrapSummaryInChannelsTree(summarizeResult: ISummaryTreeWithStats): void {
    summarizeResult.summary = {
        type: SummaryType.Tree,
        tree: { [channelsTreeName]: summarizeResult.summary },
    };
    summarizeResult.stats.treeNodeCount++;
}