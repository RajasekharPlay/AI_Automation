/**
 * Triggers GitHub Actions workflow_dispatch to run tests
 */
async function triggerGithubAction(runId) {
  const { GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO } = process.env;

  if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO) {
    throw new Error('Missing GitHub env vars: GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO');
  }

  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/workflows/run-tests.yml/dispatches`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      ref: 'main',
      inputs: { run_id: runId }
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GitHub Actions trigger failed: ${response.status} - ${error}`);
  }

  console.log(`✅ GitHub Actions triggered for run: ${runId}`);
  return true;
}

module.exports = { triggerGithubAction };
