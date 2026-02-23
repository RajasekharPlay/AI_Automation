const router = require('express').Router();
const { supabase } = require('../lib/supabase');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');

const r2 = new S3Client({
  region: 'auto',
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_KEY
  }
});

// GET proxy R2 artifact (screenshot/trace) to frontend — bypasses auth requirement
router.get('/proxy', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'url required' });

    const endpoint = process.env.CLOUDFLARE_R2_ENDPOINT;
    const bucket = process.env.R2_BUCKET_NAME;
    const prefix = `${endpoint}/${bucket}/`;

    if (!url.startsWith(prefix)) {
      return res.status(400).json({ error: 'Not a valid R2 artifact URL' });
    }

    const key = url.slice(prefix.length);
    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    const response = await r2.send(command);

    res.setHeader('Content-Type', response.ContentType || 'application/octet-stream');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    if (response.ContentLength) res.setHeader('Content-Length', response.ContentLength);

    for await (const chunk of response.Body) {
      res.write(chunk);
    }
    res.end();
  } catch (err) {
    console.error('Artifact proxy error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET artifacts for a test case
router.get('/testcase/:testCaseId', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('artifacts')
      .select('*')
      .eq('test_case_id', req.params.testCaseId);

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST save artifact record
router.post('/', async (req, res) => {
  try {
    const { test_case_id, run_id, type, url } = req.body;
    const { data, error } = await supabase
      .from('artifacts')
      .insert({ test_case_id, run_id, type, url })
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
