import {
  validateAiSuggestion,
  type AiSuggestion,
} from "../../../src/features/assistant/ai-suggestions.ts";
import {
  buildHelpRequest,
  buildParseRequest,
  callGemini,
  cleanAnswer,
  parseJsonReply,
} from "../../../src/features/assistant/gemini.ts";

/**
 * Wraps Gemini behind quota accounting and total fault tolerance: every method
 * resolves to null instead of throwing, so the bot falls back to its
 * deterministic behaviour whenever the AI is off, limited, slow, or wrong.
 */

export type AiFeature = "transaction_parser" | "assistant_help";

export interface AssistantQuotaStore {
  claim(
    ownerUserId: string,
    feature: AiFeature,
    model: string,
  ): Promise<{ outcome: string; usageId: string | null }>;
  finish(
    usageId: string,
    outcome: "success" | "failure",
    inputTokens: number,
    outputTokens: number,
  ): Promise<void>;
}

export type AssistantConfig = {
  apiKey?: string;
  model?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

export interface AssistantPort {
  readonly enabled: boolean;
  suggestFields(input: {
    ownerUserId: string;
    text: string;
    fieldsNeeded: readonly string[];
    categoryKeys: readonly string[];
  }): Promise<AiSuggestion | null>;
  answer(input: {
    ownerUserId: string;
    question: string;
  }): Promise<string | null>;
}

export function createAssistant(
  config: AssistantConfig,
  quota: AssistantQuotaStore,
): AssistantPort {
  const apiKey = config.apiKey?.trim();
  const model = config.model?.trim();
  // No key or no explicit model name means the assistant is simply off.
  const enabled = Boolean(apiKey && model);

  async function run<T>(
    ownerUserId: string,
    feature: AiFeature,
    body: Parameters<typeof callGemini>[0]["body"],
    interpret: (text: string) => T | null,
  ): Promise<T | null> {
    if (!enabled || !apiKey || !model) return null;

    let usageId: string | null = null;
    try {
      const claim = await quota.claim(ownerUserId, feature, model);
      if (claim.outcome !== "ok" || !claim.usageId) return null;
      usageId = claim.usageId;
    } catch {
      return null;
    }

    try {
      const result = await callGemini({
        apiKey,
        body,
        fetchImpl: config.fetchImpl,
        model,
        timeoutMs: config.timeoutMs,
      });
      const interpreted = interpret(result.text);
      await quota
        .finish(usageId, "success", result.inputTokens, result.outputTokens)
        .catch(() => undefined);
      return interpreted;
    } catch {
      await quota.finish(usageId, "failure", 0, 0).catch(() => undefined);
      return null;
    }
  }

  return {
    enabled,

    answer({ ownerUserId, question }) {
      return run(
        ownerUserId,
        "assistant_help",
        buildHelpRequest(question),
        cleanAnswer,
      );
    },

    suggestFields({ ownerUserId, text, fieldsNeeded, categoryKeys }) {
      return run(
        ownerUserId,
        "transaction_parser",
        buildParseRequest({ categoryKeys, fieldsNeeded, text }),
        (reply) =>
          validateAiSuggestion(parseJsonReply(reply), { categoryKeys, text }),
      );
    },
  };
}
