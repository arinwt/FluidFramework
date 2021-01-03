/*!
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { ISnapshotTree } from "@fluidframework/protocol-definitions";
import { channelsTreeName } from "@fluidframework/runtime-definitions";

export type ContainerRuntimeSnapshotFormatVersion =
    /**
     * Format version is missing from snapshot.
     * This indicates it is an older version.
     */
    | undefined
    /**
     * Introduces .metadata blob and .channels trees for isolation of
     * data store trees from container-level objects.
     */
    | "0.1";

export type DataStoreSnapshotFormatVersion =
    /**
     * Format version is missing from snapshot.
     * This indicates it is an older version.
     */
    | undefined
    /**
     * From this version the pkg within the data store
     * attributes blob is a JSON array rather than a string.
     */
    | "0.1"
    /**
     * Introduces .channels trees for isolation of
     * channel trees from data store objects.
     */
    | "0.2";

export const metadataBlobName = ".metadata";
export const chunksBlobName = ".chunks";
export const blobsTreeName = ".blobs";

export interface IContainerRuntimeMetadata {
    snapshotFormatVersion: ContainerRuntimeSnapshotFormatVersion;
}

export const protocolTreeName = ".protocol";

/**
 * List of tree IDs at the container level which are reserved.
 * This is for older versions of snapshots that do not yet have an
 * isolated data stores namespace. Without the namespace, this must
 * be used to prevent name collisions with data store IDs.
 */
export const nonDataStorePaths = [protocolTreeName, ".logTail", ".serviceProtocol", blobsTreeName];

export const dataStoreAttributesBlobName = ".component";

export interface IRuntimeSnapshot {
    id: string | null;
    blobs: {
        [chunksBlobName]: string;
        [metadataBlobName]: string;
    };
    trees: {
        [protocolTreeName]: ISnapshotTree;
        [blobsTreeName]: ISnapshotTree;
        [channelsTreeName]: ISnapshotTree;
    },
}