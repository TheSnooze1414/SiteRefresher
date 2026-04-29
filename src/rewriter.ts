import Anthropic from "@anthropic-ai/sdk";
import pLimit from "p-limit";
import type { Change, Segment, SegmentAnalysis, Rewrite } from "./types.js";

const client = new Anthropic();

const REWRITE_TOOL: Anthropic.Tool = {
  name: "propose_rewrite",
  description: "Propose updated copy for a flagged segment.",
  input_schema: {
    type: "object" as const,
    properties: {
      proposedCopy: {
        type: "string",
        description: "The full proposed replacement copy for this segment",
      },
      rationale: {
        type: "string",
        description: "Brief explanation of what was changed and why",
      },
    },
    required: ["proposedCopy", "rationale"],
    additionalProperties: false,
  },
};

async function rewriteOne(
  segment: Segment,
  analysis: SegmentAnalysis,
  guidelines: string
): Promise<Rewrite> {
  const changesDesc = analysis.relevantChanges
    .map((c: Change) => `• ${c.attribute}: "${c.oldValue}" → "${c.newValue}" (${c.changeType})`)
    .join("\n");

  const response = await client.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 1024,
    tools: [REWRITE_TOOL],
    tool_choice: { type: "tool", name: "propose_rewrite" },
    system: [
      {
        type: "text",
        text: `You are a product copywriter. Rewrite flagged copy segments to reflect spec changes, following the provided style guidelines.\n\nStyle guidelines:\n${guidelines}`,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: `The following copy segment needs updating:\n\nOriginal copy:\n"${segment.text}"\n\nSpec changes that affect this segment:\n${changesDesc}\n\nReason flagged: ${analysis.reason}\n\nPropose a rewrite that incorporates the new spec values while preserving the tone, length, and style of the original. Call propose_rewrite with your revised copy and a brief rationale.`,
      },
    ],
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error(`rewriter: Claude did not call propose_rewrite for segment ${segment.id}`);
  }

  const input = toolUse.input as { proposedCopy: string; rationale: string };
  return {
    segmentId: segment.id,
    proposedCopy: input.proposedCopy,
    rationale: input.rationale,
  };
}

export async function rewriteSegments(
  segments: Segment[],
  analyses: SegmentAnalysis[],
  guidelines: string,
  concurrency = 3
): Promise<Rewrite[]> {
  const affectedAnalyses = analyses.filter((a) => a.affected);
  if (affectedAnalyses.length === 0) return [];

  console.log(`  [rewriter] proposing rewrites for ${affectedAnalyses.length} segments...`);

  const limit = pLimit(concurrency);
  const segmentMap = new Map(segments.map((s) => [s.id, s]));

  const rewrites = await Promise.all(
    affectedAnalyses.map((analysis) =>
      limit(async () => {
        const segment = segmentMap.get(analysis.segmentId);
        if (!segment) return null;
        return rewriteOne(segment, analysis, guidelines);
      })
    )
  );

  return rewrites.filter((r): r is Rewrite => r !== null);
}
