const express = require('express');
const cors    = require('cors');
const axios   = require('axios');
require('dotenv').config();

const app  = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://vu-game.vercel.app',
  ]
}));
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
    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500,
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type':  'application/json',
        },
      }
    );

    const explanation = response.data?.choices?.[0]?.message?.content || 'Explanation nahi mil saki.';
    return res.json({ explanation });

  } catch (err) {
    if (err.response) {
      console.error('Groq error status:', err.response.status);
      console.error('Groq error data:', JSON.stringify(err.response.data, null, 2));
      return res.status(502).json({ error: 'AI service error: ' + (err.response.data?.error?.message || 'Unknown') });
    }
    console.error('Server error:', err.message);
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

/* ── Health check ── */
app.get('/api/health', (_, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`✅ VU Backend running on http://localhost:${PORT}`);
});