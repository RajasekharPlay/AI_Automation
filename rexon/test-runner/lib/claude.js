const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function healSelector(failedSelector, domSnapshot, errorMessage, originalScript) {
  const truncatedDom = domSnapshot.substring(0, 4000);

  const prompt = `You are a Playwright self-healing agent. A test failed.

Failed selector/error: ${failedSelector}
Full error: ${errorMessage}

Current page DOM snapshot (truncated to 4000 chars):
${truncatedDom}

Original test script:
${originalScript}

Instructions:
1. Analyze why the selector failed
2. Look at the DOM to find the correct element
3. Provide a fixed script

Respond with ONLY a JSON object (no markdown):
{
  "newSelector": "corrected selector string",
  "reason": "brief explanation",
  "patchedScript": "complete fixed JavaScript test script"
}`;

  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }]
    });

    let text = response.content[0].text.trim();
    text = text.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '');
    return JSON.parse(text);
  } catch (err) {
    console.error('Claude healing error:', err.message);
    return null;
  }
}

module.exports = { healSelector };
