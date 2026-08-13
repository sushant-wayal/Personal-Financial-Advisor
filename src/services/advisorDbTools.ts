/**
 * advisorDbTools.ts — AI Advisor tool definitions & execution layer.
 *
 * All tool implementations have been modularized under `src/services/advisor/tools/`.
 * This file maintains full backward compatibility by re-exporting the tool surface.
 */

export type { ToolName, ToolCallRequest, ToolCallResult } from "./advisor/tools/advisorToolTypes";
export { ADVISOR_TOOL_DECLARATIONS } from "./advisor/tools/advisorToolDeclarations";
export { executeAdvisorTool } from "./advisor/tools/advisorExecutor";
