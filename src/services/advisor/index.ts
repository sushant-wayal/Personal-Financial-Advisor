/**
 * Advisor/AI domain — barrel re-export.
 *
 * All advisor and AI-related services live in the parent `src/services/` directory.
 * This barrel makes them importable as a domain group:
 *   import { runAdvisorAgenticLoop } from "@/src/services/advisor"
 *
 * For AI agents: this is the domain for the Gemini LLM client, the agentic
 * tool-call loop, database tool declarations, artifact parsing, and the
 * financial context builder used as the AI system prompt.
 */
export * from "../gemini";
export * from "../advisorAgenticLoop";
export * from "../advisorDbTools";
export * from "../advisorArtifacts";
export * from "../aiContext";
export * from "../AIGoalAdvisorService";
