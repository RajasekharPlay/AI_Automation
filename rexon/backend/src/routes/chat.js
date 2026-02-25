const express = require('express');
const router = express.Router();
const { supabase } = require('../lib/supabase');
const { classifyIntent, generateTestPlan, chatReply } = require('../lib/claude');
const { triggerGithubAction } = require('../lib/github');
const { decrypt } = require('../lib/encryption');

/**
 * POST /api/chat — main chatbot endpoint
 * Body: { message, session_id, project_id?, context? }
 */
router.post('/', async (req, res) => {
  const { message, session_id, project_id, context = {} } = req.body;
  if (!message || !session_id) return res.status(400).json({ error: 'message and session_id required' });

  try {
    // Classify intent
    const classification = await classifyIntent(message, { ...context, project_id });
    const { intent, entities } = classification;

    // Save user message
    await supabase.from('chat_messages').insert({
      session_id, project_id, role: 'user', content: message, intent
    });

    let reply = '';
    let actionTaken = null;

    // ── Route by intent ───────────────────────────────────────────────────────
    switch (intent) {

      case 'list_tests': {
        const query = supabase.from('testcases')
          .select('id, name, status, pass_rate, last_run_at, run_count')
          .order('updated_at', { ascending: false }).limit(20);
        if (project_id) query.eq('project_id', project_id);
        const { data: tests } = await query;
        actionTaken = { type: 'list_tests', results: tests };
        reply = tests?.length
          ? `Found **${tests.length} test cases**:\n\n${tests.map((t, i) =>
              `${i+1}. **${t.name}** — ${t.status || 'idle'} | Pass rate: ${t.pass_rate || 0}% | Runs: ${t.run_count || 0}`
            ).join('\n')}`
          : 'No test cases found. Would you like to create one?';
        break;
      }

      case 'run_test': {
        // Find matching testcase by name or ID
        let tc = null;
        if (entities.testcaseId) {
          const { data } = await supabase.from('testcases').select('*').eq('id', entities.testcaseId).single();
          tc = data;
        } else if (entities.testName) {
          const { data } = await supabase.from('testcases').select('*')
            .ilike('name', `%${entities.testName}%`).limit(1).single();
          tc = data;
        }

        if (!tc) {
          // Try to run all failed tests
          const { data: failedTests } = await supabase.from('testcases')
            .select('id, name').eq('status', 'failed').limit(5);
          if (failedTests?.length) {
            actionTaken = { type: 'run_failed_tests', count: failedTests.length };
            const runIds = [];
            for (const t of failedTests) {
              try {
                const { data: run } = await supabase.from('test_runs').insert({
                  name: `Rerun — ${t.name}`, status: 'pending', total: 1, testcase_id: t.id, project_id
                }).select().single();
                await triggerGithubAction(run.id).catch(() => {});
                runIds.push(run.id);
              } catch (_) {}
            }
            reply = `Triggered **${runIds.length} reruns** for all failed tests. Run IDs:\n${runIds.map(id => `- \`${id}\``).join('\n')}`;
          } else {
            reply = 'No failed tests found to run. Please specify a test name or ID.';
          }
        } else {
          const { data: run } = await supabase.from('test_runs').insert({
            name: `Rerun — ${tc.name}`, status: 'pending', total: 1, testcase_id: tc.id, project_id
          }).select().single();
          await supabase.from('test_cases').insert({
            run_id: run.id, name: tc.name, status: 'pending', test_plan_json: tc.test_plan_json
          });
          await triggerGithubAction(run.id).catch(() => {});
          await supabase.from('testcases').update({ last_run_at: new Date(), run_count: (tc.run_count || 0) + 1, status: 'running' }).eq('id', tc.id);
          actionTaken = { type: 'run_test', runId: run.id };
          reply = `Triggered run for **${tc.name}**.\nRun ID: \`${run.id}\`\nView: [Open Run](/run/${run.id})`;
        }
        break;
      }

      case 'generate_plan': {
        const url = entities.url || context.currentUrl;
        const domSnapshotId = context.domSnapshotId;
        let domMap = null;
        if (domSnapshotId) {
          const { data: snap } = await supabase.from('dom_snapshots').select('dom_map_json').eq('id', domSnapshotId).single();
          domMap = snap?.dom_map_json;
        }
        const plan = await generateTestPlan(message, domMap, !!context.credentialId);
        if (plan) {
          actionTaken = { type: 'generate_plan', plan };
          reply = `Generated test plan for **${plan.name}**:\n\n**Steps (${plan.steps?.length || 0}):**\n${
            (plan.steps || []).map(s => `${s.index}. ${s.action.toUpperCase()} — ${s.description}`).join('\n')
          }\n\n**Assertions:**\n${(plan.assertions || []).map(a => `- ${a}`).join('\n')}\n\n> Would you like me to save this test case?`;
        } else {
          reply = 'Could not generate a test plan. Please provide more details about what you want to test.';
        }
        break;
      }

      case 'analyze_failure': {
        let runId = entities.runId || context.currentRunId;
        if (runId) {
          const { data: testCases } = await supabase.from('test_cases')
            .select('id, name, status, error, ai_actions').eq('run_id', runId).eq('status', 'failed');
          if (testCases?.length) {
            actionTaken = { type: 'analyze_failure', failures: testCases.length };
            const failureSummary = testCases.map(tc => `- **${tc.name}**: ${tc.error || 'Unknown error'}`).join('\n');
            reply = await chatReply(
              [{ role: 'user', content: `Analyze these test failures and explain what went wrong:\n${failureSummary}\n\nUser asked: ${message}` }],
              context
            );
          } else {
            reply = 'No failed tests found for that run. Run ID might be incorrect.';
          }
        } else {
          reply = await chatReply([{ role: 'user', content: message }], context);
        }
        break;
      }

      case 'create_test': {
        const plan = await generateTestPlan(message, null, !!context.credentialId);
        if (plan) {
          let savedTc = null;
          if (project_id) {
            const { data } = await supabase.from('testcases').insert({
              project_id,
              name: plan.name,
              test_plan_json: plan,
              credential_id: context.credentialId || null,
              dom_snapshot_id: context.domSnapshotId || null
            }).select().single();
            savedTc = data;
          }
          actionTaken = { type: 'create_test', plan, savedId: savedTc?.id };
          reply = `Created test case **${plan.name}**${savedTc ? ` (ID: \`${savedTc.id}\`)` : ''}.\n\n**Steps:**\n${
            (plan.steps || []).map(s => `${s.index}. ${s.action.toUpperCase()} — ${s.description}`).join('\n')
          }\n\nWould you like to run it now?`;
        } else {
          reply = 'Please describe what you want to test in more detail (e.g., "Create login test for https://app.example.com").';
        }
        break;
      }

      case 'crawl_dom': {
        const url = entities.url;
        if (!url) {
          reply = 'Please provide a URL to crawl, e.g., "Crawl https://app.example.com"';
        } else {
          actionTaken = { type: 'crawl_dom', url };
          reply = `Starting DOM crawl for **${url}**...\n\nThis will:\n1. Visit the URL\n2. Extract interactive elements from up to 5 pages\n3. Store the DOM snapshot\n\nThe crawl runs as a GitHub Action. Check back in ~2 minutes.`;
          // Trigger crawl workflow
          try {
            const fetch = require('node-fetch');
            await fetch(`https://api.github.com/repos/${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO}/actions/workflows/dom-crawl.yml/dispatches`, {
              method: 'POST',
              headers: { Authorization: `token ${process.env.GITHUB_TOKEN}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ ref: 'main', inputs: { url, project_id: project_id || '' } })
            });
          } catch (e) { reply += `\n\n> ⚠ Could not trigger crawl: ${e.message}`; }
        }
        break;
      }

      case 'modify_test': {
        let tc = null;
        if (entities.testcaseId) {
          const { data } = await supabase.from('testcases').select('*').eq('id', entities.testcaseId).single();
          tc = data;
        }
        if (tc?.test_plan_json) {
          const modifiedPlan = await generateTestPlan(
            `Modify this existing test plan: ${JSON.stringify(tc.test_plan_json)}\n\nUser request: ${message}`,
            null, false
          );
          if (modifiedPlan) {
            await supabase.from('testcases').update({ test_plan_json: modifiedPlan, updated_at: new Date() }).eq('id', tc.id);
            actionTaken = { type: 'modify_test', testcaseId: tc.id };
            reply = `Updated test **${tc.name}**. New steps:\n\n${(modifiedPlan.steps || []).map(s => `${s.index}. ${s.action.toUpperCase()} — ${s.description}`).join('\n')}`;
          } else {
            reply = await chatReply([{ role: 'user', content: message }], context);
          }
        } else {
          reply = 'Please specify which test to modify by providing the test ID. You can get it from the Test Cases list.';
        }
        break;
      }

      default: {
        // General / small talk — let Claude reply conversationally
        const history = await supabase.from('chat_messages')
          .select('role, content').eq('session_id', session_id)
          .order('created_at', { ascending: true }).limit(10);
        const msgs = (history.data || []).map(m => ({ role: m.role, content: m.content }));
        msgs.push({ role: 'user', content: message });
        reply = await chatReply(msgs, context);
        break;
      }
    }

    // Save assistant reply
    await supabase.from('chat_messages').insert({
      session_id, project_id, role: 'assistant', content: reply,
      intent, action_taken: actionTaken
    });

    res.json({ reply, intent, action: actionTaken });

  } catch (e) {
    console.error('Chat error:', e);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/chat/history/:session_id
router.get('/history/:session_id', async (req, res) => {
  try {
    const { data, error } = await supabase.from('chat_messages')
      .select('*').eq('session_id', req.params.session_id)
      .order('created_at', { ascending: true }).limit(50);
    if (error) throw error;
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/chat/history/:session_id
router.delete('/history/:session_id', async (req, res) => {
  try {
    await supabase.from('chat_messages').delete().eq('session_id', req.params.session_id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
