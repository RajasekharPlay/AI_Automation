const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Categorizes a test failure using Claude.
 * Returns a structured object: { category, explanation, fixApproach, isHealable }
 */
async function analyzeFailure({ errorMessage, domSnapshot, script }) {
  const truncatedDom = (domSnapshot || '').substring(0, 3000);

  const prompt = `You are a Playwright test failure analyst. Categorize this failure.

Error: ${errorMessage}

Page DOM snapshot (truncated):
${truncatedDom}

Current test script:
${script || '(not available)'}

Return ONLY a JSON object (no markdown, no explanation outside JSON):
{
  "category": "selector_not_found | timeout | navigation_error | assertion_error | auth_error | other",
  "explanation": "brief one-sentence reason",
  "fixApproach": "suggested fix in one sentence",
  "isHealable": true
}`;

  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }]
    });

    let text = response.content[0].text.trim();
    text = text.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '');
    return JSON.parse(text);
  } catch (err) {
    return {
      category: 'other',
      explanation: errorMessage,
      fixApproach: 'Manual investigation required.',
      isHealable: false
    };
  }
}

module.exports = { analyzeFailure };
