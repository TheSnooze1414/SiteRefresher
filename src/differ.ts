import Anthropic from "@anthropic-ai/sdk";
import type { Change, ChangeSet } from "./types.js";

const client = new Anthropic();

const DIFF_TOOL: Anthropic.Tool = {
  name: "report_changes",
  description: "Report the structured set of changes between two spec documents.",
  input_schema: {
    type: "object" as const,
    properties: {
      changes: {
        type: "array",
        items: {
          type: "object",
          properties: {
            attribute: { type: "string", description: "The feature or attribute that changed" },
            oldValue: { type: "string", description: "The old value or description" },
            newValue: { type: "string", description: "The new value or description" },
            changeType: {
              type: "string",
              enum: ["added", "removed", "updated"],
              description: "Nature of the change",
            },
            context: {
              type: "string",
              description: "Optional extra context about this change",
            },
          },
          required: ["attribute", "oldValue", "newValue", "changeType"],
          additionalProperties: false,
        },
      },
    },
    required: ["changes"],
    additionalProperties: false,
  },
};

export async function diffSpecs(oldSpec: string, newSpec: string): Promise<ChangeSet> {
  console.log("  [differ] diffing spec documents via Claude...");

  const response = await client.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 4096,
    tools: [DIFF_TOOL],
    tool_choice: { type: "tool", name: "report_changes" },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "You are a product copywriter's assistant. Compare these two specification documents and identify every meaningful change — updated specs, new features, removed features, revised values. Focus on changes that would require updating marketing or product copy.\n\n",
          },
          {
            type: "text",
            text: `<old_spec>\n${oldSpec}\n</old_spec>`,
            cache_control: { type: "ephemeral" },
          },
          {
            type: "text",
            text: `<new_spec>\n${newSpec}\n</new_spec>`,
            cache_control: { type: "ephemeral" },
          },
          {
            type: "text",
            text: "Call report_changes with the full list of differences between the old and new spec.",
          },
        ],
      },
    ],
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("differ: Claude did not call report_changes tool");
  }

  const input = toolUse.input as { changes: Change[] };
  console.log(`  [differ] found ${input.changes.length} changes`);
  return input.changes;
}
