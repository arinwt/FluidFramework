/*!
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { strict as assert } from "assert";
import { TelemetryNullLogger } from "@fluidframework/common-utils";
import { cloneGCData } from "@fluidframework/garbage-collector";
import { SummaryType } from "@fluidframework/protocol-definitions";
import {
    CreateSummarizerNodeSource,
    IGCData,
    ISummarizeInternalResult,
    ISummarizerNodeWithGC,
    SummarizeInternalFn,
} from "@fluidframework/runtime-definitions";
// eslint-disable-next-line import/no-internal-modules
import { createRootSummarizerNodeWithGC, IRootSummarizerNodeWithGC } from "../summarizerNode/summarizerNodeWithGc";
import { mergeStats } from "../summaryUtils";

describe("SummarizerNodeWithGC Tests", () => {
    const summarizerNodeId = "testNode";
    const node1Id = "/gcNode1";
    const node2Id = "/gcNode2";
    const subNode1Id = "/gcNode1/subNode";
    const subNode2Id = "/gcNode2/subNode";

    let internalGCData: IGCData;
    let initialGCData: IGCData | undefined;
    let summarizeGCData: IGCData;
    let rootSummarizerNode: IRootSummarizerNodeWithGC;
    let summarizerNode: ISummarizerNodeWithGC;

    beforeEach(async () => {
        rootSummarizerNode = createRootSummarizerNodeWithGC(
            new TelemetryNullLogger(),
            (() => undefined) as unknown as SummarizeInternalFn,
            0,
            0);
        rootSummarizerNode.startSummary(0, new TelemetryNullLogger());

        summarizerNode = rootSummarizerNode.createChild(
            summarizeInternal,
            summarizerNodeId,
            { type: CreateSummarizerNodeSource.FromSummary },
            undefined,
            getInternalGCData,
            getInitialGCData,
        );

        // Initialize the values to be returned by getGCNodeInternal.
        internalGCData = {
            gcNodes: {
                "/": [ node1Id, node2Id ],
                "/gcNode1": [ subNode1Id ],
            },
        };

        // Initialize the values to be returned by getInitialGCNodes. This is empty to begin with.
        initialGCData = {
            gcNodes: {},
        };

        // Initialize the values to be returned by summarizeInternal. This is empty to being with.
        summarizeGCData = {
            gcNodes: {},
        };
    });

    async function summarizeInternal(fullTree: boolean, trackState: boolean): Promise<ISummarizeInternalResult> {
        const stats = mergeStats();
        stats.treeNodeCount++;
        return {
            summary: {
                type: SummaryType.Tree,
                tree: {},
            },
            stats,
            id: summarizerNodeId,
            gcData: summarizeGCData,
        };
    }

    const getInternalGCData = async (): Promise<IGCData> => internalGCData;
    const getInitialGCData = async (): Promise<IGCData | undefined> => initialGCData;

    describe("getGCData API", () => {
        it("fails when function to get GC data is not provided", async () => {
            // Root sumamrizer node does not have the function to get GC data. Trying to get GC data from it should
            // fail.
            let failed = false;
            try {
                await rootSummarizerNode.getGCData();
            } catch {
                failed = true;
            }
            assert(failed, "Getting GC data should have failed");
        });

        it("can return GC data when data has changed since last summary", async () => {
            // Invalidate the summarizer node to force it to generate GC data and not use cached value.
            summarizerNode.invalidate(10);

            const gcData = await summarizerNode.getGCData();
            assert.deepStrictEqual(gcData, internalGCData, "GC data should be generated by calling getInternalGCData");
        });

        it("can return initial GC data when nothing has changed since last summary", async () => {
            // Set the data to be returned by getInitialGCData.
            initialGCData = {
                gcNodes: {
                    "/": [ node1Id ],
                    "gcNode1": [ "/" ],
                    "gcNode2": [ subNode1Id, subNode2Id ],
                },
            };

            // We did not invalidate the summarizer node, so it will get the initial GC data because nothing changed
            // since last summary.
            const gcData = await summarizerNode.getGCData();
            assert.deepStrictEqual(gcData, initialGCData, "Initial GC data should have been returned");
        });

        it("can return GC data when initial GC data is not available", async () => {
            // Set initial GC data to undefined. This will force the summarizer node to generate GC data even though
            // nothing changed since last summary.
            initialGCData = undefined;

            const gcData = await summarizerNode.getGCData();
            assert.deepStrictEqual(gcData, internalGCData, "GC data should be generated by calling getInternalGCData");
        });

        it("can return cached GC data", async () => {
            // Set initial GC data to undefined. This will force the summarizer node to generate GC data even though
            // nothing changed since last summary.
            initialGCData = undefined;
            const gcData = await summarizerNode.getGCData();
            assert.deepStrictEqual(gcData, internalGCData, "GC data should be generated by calling getInternalGCData");

            // Make a clone of the GC data returned above because we are about to change it.
            const cachedGCData = cloneGCData(gcData);

            // Add a new node to the GC data returned by getInternalGCData.
            internalGCData.gcNodes[subNode1Id] = [ "/", subNode2Id ];

            // Since nothing changed since last summary, summarizer node should return the data from the previous run.
            const newGCData = await summarizerNode.getGCData();
            assert.deepStrictEqual(newGCData, cachedGCData, "GC data from previous run should be returned");
        });
    });

    describe("summarize API", () => {
        beforeEach(() => {
            summarizeGCData = {
                gcNodes: {
                    "/": [ node1Id ],
                    "gcNode1": [ "/" ],
                    "gcNode2": [ subNode1Id, subNode2Id ],
                },
            };
        });

        it("can return GC data when data has changed since last summary", async () => {
            // Invalidate the summarizer node to force it to generate summary and not use cached value.
            summarizerNode.invalidate(10);

            // Call summarize with fullTree as true which should generate GC data by calling summarizeInternal.
            const summarizeResult = await summarizerNode.summarize(true /* fullTree */);
            assert.deepStrictEqual(
                summarizeResult.gcData,
                summarizeGCData,
                "GC data should be generated by calling summarizeInternal");
        });

        it("can return GC data when nothing changed since last summary", async () => {
            // Set initial GC data to undefined. This will force the summarizer node to generate GC data even though
            // nothing changed since last summary.
            initialGCData = undefined;

            // Call getGCData to generate GC data.
            const gcData = await summarizerNode.getGCData();
            assert.deepStrictEqual(gcData, internalGCData, "GC data should be generated by calling getInternalGCData");

            // Call summarize with fullTree as false which should use the cached GC data.
            const summarizeResult = await summarizerNode.summarize(false /* fullTree */);
            assert.deepStrictEqual(
                summarizeResult.gcData,
                internalGCData,
                "GC data cached by getGCData should have been returned");
        });

        it("can return GC data which is updated by summarize in getGCData", async () => {
            // Call summarize with fullTree as true which should generate GC data by calling summarizeInternal.
            const summarizeResult = await summarizerNode.summarize(true /* fullTree */);
            assert.deepStrictEqual(
                summarizeResult.gcData,
                summarizeGCData,
                "GC data should be generated by calling summarizeInternal");

            // Now call getGCData which should use GC data cached by summarize call above.
            const gcData = await summarizerNode.getGCData();
            assert.deepStrictEqual(gcData, summarizeGCData, "GC data cached by summarize should have been returned");
        });

        it("returns empty GC data when summarizing without generating GC data", async () => {
            // Call summarize with fullTree as false. This should try to get cached GC data. But since no GC data was
            // cached, this should return empty data.
            const summarizeResult = await summarizerNode.summarize(false /* fullTree */);
            assert.deepStrictEqual(summarizeResult.gcData, { gcNodes: {} }, "GC data should be empty");
        });
    });
});
