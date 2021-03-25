/*!
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { strict as assert } from "assert";
import { IsoBuffer } from "@fluidframework/common-utils";
import { ContainerMessageType, IContainerRuntimeOptions } from "@fluidframework/container-runtime";
import { IFluidHandle } from "@fluidframework/core-interfaces";
import { requestFluidObject } from "@fluidframework/runtime-utils";
import { SharedString } from "@fluidframework/sequence";
import { v4 as uuid } from "uuid";
import { ReferenceType } from "@fluidframework/merge-tree";
import { ITestObjectProvider, ITestContainerConfig } from "@fluidframework/test-utils";
import { describeFullCompat, ITestDataObject } from "@fluidframework/test-version-utils";

/** Temporary function to make backwards compatible runtime options. */
function flattenRuntimeOptions(
    runtimeOptions?: IContainerRuntimeOptions,
): IContainerRuntimeOptions | undefined {
    if (runtimeOptions === undefined) {
        return runtimeOptions;
    }

    // Promote all summaryOptions and gcOptions to top-layer.
    return {
        ...runtimeOptions.summaryOptions,
        ...runtimeOptions.gcOptions,
        ...runtimeOptions,
    };
}

const testContainerConfig: ITestContainerConfig = {
    runtimeOptions: flattenRuntimeOptions({
        summaryOptions: {
            initialSummarizerDelayMs: 20,
            summaryConfigOverrides: { maxOps: 1 },
        },
    }),
    registry: [["sharedString", SharedString.getFactory()]],
};

describeFullCompat("blobs", (getTestObjectProvider) => {
    let provider: ITestObjectProvider;
    beforeEach(async () => {
        provider = getTestObjectProvider();
    });
    it("attach sends an op", async function() {
        const container = await provider.makeTestContainer(testContainerConfig);

        const blobOpP = new Promise<void>((res, rej) => container.on("op", (op) => {
            if (op.contents?.type === ContainerMessageType.BlobAttach) {
                // eslint-disable-next-line @typescript-eslint/no-unused-expressions
                op.metadata?.blobId ? res() : rej(new Error("no op metadata"));
            }
        }));

        const dataStore = await requestFluidObject<ITestDataObject>(container, "default");
        const blob = await dataStore._runtime.uploadBlob(IsoBuffer.from("some random text"));

        dataStore._root.set("my blob", blob);

        await blobOpP;
    });

    it("can get remote attached blob", async function() {
        const testString = "this is a test string";
        const testKey = "a blob";
        const container1 = await provider.makeTestContainer(testContainerConfig);

        const dataStore1 = await requestFluidObject<ITestDataObject>(container1, "default");

        const blob = await dataStore1._runtime.uploadBlob(IsoBuffer.from(testString, "utf-8"));
        dataStore1._root.set(testKey, blob);

        const container2 = await provider.loadTestContainer(testContainerConfig);
        const dataStore2 = await requestFluidObject<ITestDataObject>(container2, "default");

        const blobHandle = await dataStore2._root.wait<IFluidHandle<ArrayBufferLike>>(testKey);
        assert(blobHandle);
        assert.strictEqual(IsoBuffer.from(await blobHandle.get()).toString("utf-8"), testString);
    });

    it("loads from snapshot", async function() {
        const container1 = await provider.makeTestContainer(testContainerConfig);
        const dataStore = await requestFluidObject<ITestDataObject>(container1, "default");
        const blob = await dataStore._runtime.uploadBlob(IsoBuffer.from("some random text"));

        // attach blob, wait for blob attach op, then take BlobManager snapshot
        dataStore._root.set("my blob", blob);
        await new Promise<void>((res, rej) => container1.on("op", (op) => {
            if (op.contents?.type === ContainerMessageType.BlobAttach) {
                // eslint-disable-next-line @typescript-eslint/no-unused-expressions
                op.metadata?.blobId ? res() : rej(new Error("no op metadata"));
            }
        }));
        const snapshot1 = (container1 as any).context.runtime.blobManager.snapshot();

        // wait for summarize, then summary ack so the next container will load from snapshot
        await new Promise<void>((resolve, reject) => {
            let summarized = false;
            container1.on("op", (op) => {
                if (op.type === "summaryAck") {
                    if (summarized) {
                        resolve();
                    }
                } else if (op.type === "summaryNack") {
                    reject(new Error("summaryNack"));
                } else if (op.type === "summarize") {
                    summarized = true;
                }
            });
        });

        const container2 = await provider.loadTestContainer(testContainerConfig);
        const snapshot2 = (container2 as any).context.runtime.blobManager.snapshot();
        assert.strictEqual(snapshot2.entries.length, 1);
        assert.strictEqual(snapshot1.entries[0].id, snapshot2.entries[0].id);
    });

    it("round trip blob handle on shared string property", async function() {
        const container1 = await provider.makeTestContainer(testContainerConfig);
        const container2 = await provider.loadTestContainer(testContainerConfig);
        const testString = "this is a test string";
        // setup
        {
            const dataStore = await requestFluidObject<ITestDataObject>(container2, "default");
            const sharedString = SharedString.create(dataStore._runtime, uuid());
            dataStore._root.set("sharedString", sharedString.handle);

            const blob = await dataStore._runtime.uploadBlob(IsoBuffer.from(testString));

            sharedString.insertMarker(0, ReferenceType.Simple, { blob });

            // wait for summarize, then summary ack so the next container will load from snapshot
            await new Promise<void>((resolve, reject) => {
                let summarized = false;
                container1.on("op", (op) => {
                    if (op.type === "summaryAck") {
                        if (summarized) {
                            resolve();
                        }
                    } else if (op.type === "summaryNack") {
                        reject(new Error("summaryNack"));
                    } else if (op.type === "summarize") {
                        summarized = true;
                    }
                });
            });
        }

        // validate on remote container, local container, and container loaded from summary
        for (const container of [container1, container2, await provider.loadTestContainer(testContainerConfig)]) {
            const dataStore2 = await requestFluidObject<ITestDataObject>(container, "default");
            const handle = await dataStore2._root.wait<IFluidHandle<SharedString>>("sharedString");
            assert(handle);
            const sharedString2 = await handle.get();

            const props = sharedString2.getPropertiesAtPosition(0);

            assert.strictEqual(IsoBuffer.from(await props.blob.get()).toString("utf-8"), testString);
        }
    });
});
