const express = require('express');
const cors    = require('cors');
require('dotenv').config();

const app  = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000' }));
app.use(express.json());

/* ── POST /api/explain ─────────────────────────────────────────────────────
   Body: { question, options, answer, subjectId }
   Returns: { explanation: "..." }
──────────────────────────────────────────────────────────────────────────── */
app.post('/api/explain', async (req, res) => {
  const { question, options, answer, subjectId } = req.body;

  if (!question || !options || !answer || !subjectId) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  const LABELS      = ['A', 'B', 'C', 'D'];
  const correct     = answer.replace(/^[ABCD]\.\s*/, '');
  const optionsList = options
    .map((o, i) => `${LABELS[i]}. ${o.replace(/^[ABCD]\.\s*/, '')}`)
    .join('\n');

  const prompt = `You are a friendly tutor for Virtual University Pakistan students studying ${subjectId}.

Question: ${question}

Options:
${optionsList}

Correct Answer: ${correct}

Explain in simple Roman Urdu + English (mix is fine) why "${correct}" is correct, and briefly why the other options are wrong. Be clear, friendly, and educational. Use bullet points. Max 6 lines.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key':    process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages:   [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Anthropic API error:', err);
      return res.status(502).json({ error: 'AI service error. Please try again.' });
    }

    const data        = await response.json();
    const explanation = data.content.map(b => b.text || '').join('');
    return res.json({ explanation });

  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

/* ── Health check ── */
app.get('/api/health', (_, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`✅ VU Backend running on http://localhost:${PORT}`);
});
