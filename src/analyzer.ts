import Anthropic from "@anthropic-ai/sdk";
import type { Change, ChangeSet, Segment, SegmentAnalysis } from "./types.js";

const client = new Anthropic();

const ANALYZE_TOOL: Anthropic.Tool = {
  name: "report_segment_analyses",
  description: "Report which copy segments are affected by the spec changes.",
  input_schema: {
    type: "object" as const,
    properties: {
      analyses: {
        type: "array",
        items: {
          type: "object",
          properties: {
            segmentId: { type: "string" },
            affected: { type: "boolean" },
            relevantChanges: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  attribute: { type: "string" },
                  oldValue: { type: "string" },
                  newValue: { type: "string" },
                  changeType: { type: "string" },
                },
                required: ["attribute", "oldValue", "newValue", "changeType"],
                additionalProperties: false,
              },
            },
            reason: { type: "string" },
          },
          required: ["segmentId", "affected", "relevantChanges", "reason"],
          additionalProperties: false,
        },
      },
    },
    required: ["analyses"],
    additionalProperties: false,
  },
};

export async function analyzeSegments(
  segments: Segment[],
  changeSet: ChangeSet,
  guidelines: string,
  pageUrl: string
): Promise<SegmentAnalysis[]> {
  if (segments.length === 0) return [];

  console.log(`  [analyzer] analyzing ${segments.length} segments for ${pageUrl}...`);

  const changeSetJson = JSON.stringify(changeSet, null, 2);
  const segmentsJson = JSON.stringify(
    segments.map((s) => ({ id: s.id, text: s.text })),
    null,
    2
  );

  const response = await client.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 8192,
    tools: [ANALYZE_TOOL],
    tool_choice: { type: "tool", name: "report_segment_analyses" },
    system: [
      {
        type: "text",
        text: `You are a copy review assistant. Your job is to determine which copy segments on a product page need to be updated because of spec changes.\n\nCopy guidelines for this project:\n${guidelines}`,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `The following spec changes have been made:\n\n${changeSetJson}`,
            cache_control: { type: "ephemeral" },
          },
          {
            type: "text",
            text: `Review these copy segments from the page at ${pageUrl} and identify which ones reference or imply any of the changed attributes. A segment is affected if it mentions, references, or could be misunderstood in light of the changes.\n\n${segmentsJson}\n\nCall report_segment_analyses with your assessment of every segment.`,
          },
        ],
      },
    ],
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("analyzer: Claude did not call report_segment_analyses tool");
  }

  const input = toolUse.input as { analyses: SegmentAnalysis[] };
  const affected = input.analyses.filter((a) => a.affected).length;
  console.log(`  [analyzer] ${affected} of ${segments.length} segments affected`);
  return input.analyses;
}
