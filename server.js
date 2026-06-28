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

// ─────────────────────────────────────────────────────────────────
//  REPLACE your existing /api/check-answer endpoint in server.js
//  with this version — forces ACTUAL numerical calculation,
//  not just conceptual explanation.
// ─────────────────────────────────────────────────────────────────

app.post('/api/check-answer', async (req, res) => {
  try {
    const { question, correctAnswer, studentAnswer, subjectId } = req.body;

    if (!question || !studentAnswer) {
      return res.status(400).json({ error: 'question and studentAnswer are required' });
    }

    const prompt = `You are an experienced ${subjectId || ''} university teacher in Pakistan. A student submitted an answer to a numerical/math problem. Your job is to SOLVE THE PROBLEM COMPLETELY WITH ACTUAL NUMBERS, not just explain the concept.

Write in ROMAN URDU mixed naturally with English technical terms (e.g. "Yahan formula lagayenge", "Ab calculate karte hain", "Value substitute karne se milta hai..."). Do NOT write in pure English. Do NOT write in Urdu script.

QUESTION:
${question}

${correctAnswer ? `MODEL SOLUTION (use this to get the correct numbers/formula — show the same calculation steps in your own words):\n${correctAnswer}\n` : ''}

STUDENT'S SUBMITTED ANSWER:
${studentAnswer}

CRITICAL INSTRUCTIONS — you MUST follow these exactly:
1. Identify the correct formula needed for this question.
2. Write down the GIVEN VALUES from the question with their units (e.g. "q1 = 4×10⁻⁶ C, r = 0.3 m").
3. SUBSTITUTE the actual numbers into the formula — show the formula with numbers plugged in, not just symbols.
4. Perform the ACTUAL ARITHMETIC step by step (multiplication, division, powers) — show the intermediate numbers, not just the final answer.
5. State the FINAL NUMERICAL ANSWER with correct units, clearly highlighted.

This is NOT optional — every response must contain real numbers being calculated, like a worked example in a textbook. Do not just describe what should be done; actually do the calculation with the numbers from the question.

Respond in EXACTLY this format:

VERDICT: [Correct / Partially Correct / Incorrect]

FEEDBACK:
- One short line: tell the student briefly if their final answer/approach matched or not (or if they wrote "I don't understand" type response, skip this and go straight to solving).
- Step 1: [formula needed and why]
- Step 2: [given values listed with units]
- Step 3: [substitute numbers into formula]
- Step 4: [show the arithmetic/calculation clearly, intermediate steps included]
- Step 5 (if needed): [further simplification]
- **Final Answer: [exact numerical value with units]**

Keep it focused — no more than 220 words, but NEVER skip the actual number-crunching. A student reading this must be able to see exactly how the final number was obtained.`;

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 800,
      }),
    });

    const data = await groqRes.json();
    const raw = data.choices?.[0]?.message?.content || '';

    const verdictMatch = raw.match(/VERDICT:\s*(Correct|Partially Correct|Incorrect)/i);
    const verdict = verdictMatch ? verdictMatch[1] : 'Unknown';
    const feedback = raw.replace(/VERDICT:.*?\n/i, '').replace(/FEEDBACK:\s*/i, '').trim();

    res.json({ verdict, feedback, raw });
  } catch (err) {
    console.error('check-answer error:', err);
    res.status(500).json({ error: 'Failed to check answer' });
  }
});