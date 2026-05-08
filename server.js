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

const GROQ_HEADERS = {
  'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
  'Content-Type':  'application/json',
};

async function groq(messages, max_tokens = 600) {
  const res = await axios.post(
    'https://api.groq.com/openai/v1/chat/completions',
    { model: 'llama-3.1-8b-instant', messages, max_tokens },
    { headers: GROQ_HEADERS }
  );
  return res.data.choices[0].message.content;
}

/* ── POST /api/explain ── */
app.post('/api/explain', async (req, res) => {
  const { question, options, answer, subjectId } = req.body;
  if (!question || !options || !answer || !subjectId)
    return res.status(400).json({ error: 'Missing fields.' });

  const LABELS      = ['A', 'B', 'C', 'D'];
  const correct     = answer.replace(/^[ABCD]\.\s*/, '');
  const optionsList = options.map((o, i) => `${LABELS[i]}. ${o.replace(/^[ABCD]\.\s*/, '')}`).join('\n');

  const prompt = `You are a helpful tutor for Virtual University Pakistan students studying ${subjectId}.

Question: ${question}

Options:
${optionsList}

Correct Answer: ${correct}

Write a clear explanation in simple English (no Roman Urdu). Explain:
- Why the correct answer is right (2-3 sentences)
- Why each wrong option is incorrect (1 sentence each)

Use bullet points. Keep it short and easy to understand.`;

  try {
    const explanation = await groq([{ role: 'user', content: prompt }], 500);
    return res.json({ explanation });
  } catch (err) {
    console.error('Explain error:', err.response?.data || err.message);
    return res.status(502).json({ error: 'AI service error.' });
  }
});

/* ── POST /api/summary ── */
app.post('/api/summary', async (req, res) => {
  const { subjectId, lectureNum, lectureTitle, questions } = req.body;
  if (!subjectId || !lectureNum || !questions?.length)
    return res.status(400).json({ error: 'Missing fields.' });

  // Build context from MCQ questions
  const qContext = questions
    .map((q, i) => `Q${i+1}: ${q.q}\nAnswer: ${q.answer.replace(/^[ABCD]\.\s*/, '')}`)
    .join('\n\n');

  const prompt = `You are a study assistant for Virtual University Pakistan students.

Subject: ${subjectId}
Lecture ${lectureNum}: ${lectureTitle || ''}

Based on these MCQ questions from this lecture, create a comprehensive study summary:

${qContext}

Write a well-structured summary with:
**Key Topics Covered:**
- List main topics

**Important Concepts:**
- Explain each key concept in 1-2 sentences

**Key Facts to Remember:**
- Important facts, dates, formulas, definitions

**Quick Revision Points:**
- 5-7 bullet points students must remember for exam

Keep the language simple and clear. Format with bold headings using ** **.`;

  try {
    const summary = await groq([{ role: 'user', content: prompt }], 800);
    return res.json({ summary });
  } catch (err) {
    console.error('Summary error:', err.response?.data || err.message);
    return res.status(502).json({ error: 'AI service error.' });
  }
});

/* ── POST /api/chat ── */
app.post('/api/chat', async (req, res) => {
  const { subjectId, lectureNum, lectureTitle, questions, messages } = req.body;
  if (!subjectId || !messages?.length)
    return res.status(400).json({ error: 'Missing fields.' });

  const qContext = questions
    ?.map((q, i) => `Q${i+1}: ${q.q} — Answer: ${q.answer.replace(/^[ABCD]\.\s*/, '')}`)
    .join('\n') || '';

  const systemPrompt = `You are a helpful tutor for Virtual University Pakistan students.
Subject: ${subjectId}, Lecture ${lectureNum}: ${lectureTitle || ''}

Context from this lecture's MCQs:
${qContext}

Answer student questions clearly in simple English. Be concise and helpful. 
If asked something outside this lecture, still try to help based on general knowledge.
Use bullet points when listing things. Keep answers short (3-5 sentences max).`;

  const chatMessages = [
    { role: 'system', content: systemPrompt },
    ...messages
  ];

  try {
    const reply = await groq(chatMessages, 400);
    return res.json({ reply });
  } catch (err) {
    console.error('Chat error:', err.response?.data || err.message);
    return res.status(502).json({ error: 'AI service error.' });
  }
});

/* ── Health check ── */
app.get('/api/health', (_, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`✅ VU Backend running on http://localhost:${PORT}`);
});