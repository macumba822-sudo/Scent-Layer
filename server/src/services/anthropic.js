import Anthropic from '@anthropic-ai/sdk';

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) console.warn('[anthropic] ANTHROPIC_API_KEY not set, AI endpoints will return 503');

export const anthropic = apiKey ? new Anthropic({ apiKey }) : null;
// Current Claude API model used by Scent Layer AI tools.
// Can still be overridden from the server with ANTHROPIC_MODEL.
export const MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-5-5';

/**
 * Call Claude with a tool schema and return the parsed tool input.
 * Sonnet 5.5 no longer supports forced tool_choice ('tool' / 'any'), so the
 * tool is offered in auto mode and the prompt explicitly requires its use.
 */
export async function structuredCall({ system, user, toolName, schema, maxTokens = 1024 }) {
  if (!anthropic) {
    const err = new Error('AI service not configured, ANTHROPIC_API_KEY missing on the server');
    err.status = 503;
    throw err;
  }
  let response;
  try {
    response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      tools: [{ name: toolName, description: `Return the ${toolName} payload. Use this tool to answer the request.`, input_schema: schema }],
      tool_choice: { type: 'auto', disable_parallel_tool_use: true },
      messages: [{
        role: 'user',
        content: `${user}\n\nYou must return the requested result by calling the ${toolName} tool. Do not answer with plain text.`,
      }],
    });
  } catch (e) {
    // Surface the actual Anthropic error (bad model, bad key, rate limit,
    // overload, etc.) so the client can show something useful instead of a
    // generic 500. We log the full error server-side too.
    console.error('[anthropic] request failed', { model: MODEL, status: e?.status, message: e?.message });
    const err = new Error(`AI request failed: ${e?.message || 'unknown'}`);
    err.status = e?.status || 502;
    throw err;
  }
  const block = response.content.find(b => b.type === 'tool_use' && b.name === toolName);
  if (!block) {
    const err = new Error('Model did not return structured output');
    err.status = 502;
    throw err;
  }
  return block.input;
}
