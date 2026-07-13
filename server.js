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
// ─────────────────────────────────────────────────────────────────
//  REPLACE your existing /api/check-answer in server.js with this
// ─────────────────────────────────────────────────────────────────

app.post('/api/check-answer', async (req, res) => {
  try {
    const { question, correctAnswer, studentAnswer, subjectId } = req.body;

    if (!question || !studentAnswer) {
      return res.status(400).json({ error: 'question and studentAnswer are required' });
    }

    const prompt = `You are a ${subjectId || 'university'} examiner checking a student's answer. You have been given the MODEL SOLUTION — this is the GROUND TRUTH. Your job is to compare the student's answer against this model solution FAIRLY and then teach the correct method.

CRITICAL RULES YOU MUST FOLLOW:
1. The MODEL SOLUTION below is 100% correct. Do NOT second-guess it or use a different method.
2. Compare the student's FINAL NUMERICAL ANSWER against the model solution's final answer. If they match (even if notation is slightly different), mark it CORRECT.
3. If the student's answer is correct, say so clearly and still show the full worked solution.
4. Use the EXACT SAME METHOD as the model solution — same formula, same steps, same order.
5. Do NOT invent alternative methods. Stick strictly to the model solution's approach.
6. Write explanation in ROMAN URDU mixed with English (e.g. "Ab hum formula mein values daaltay hain").

QUESTION:
${question}

MODEL SOLUTION (this is the correct answer and method — follow it exactly):
${correctAnswer || 'Use standard textbook method for this subject.'}

STUDENT'S ANSWER:
${studentAnswer}

STEP 1 — VERDICT:
Compare student's final answer to the model solution's final answer.
- If they match → CORRECT
- If student showed right method but made arithmetic error → PARTIALLY CORRECT  
- If wrong method or wrong answer → INCORRECT
- If student wrote "don't know" or nothing meaningful → INCORRECT

STEP 2 — RESPONSE FORMAT (follow exactly):

VERDICT: [Correct / Partially Correct / Incorrect]

FEEDBACK:
[One line: Student ka answer [sahi tha / ghalat tha / partially sahi tha] kyunki [brief reason].]

Ab hum is question ko model solution ki tarah step by step solve karte hain:

Step 1: [formula ya concept jo use hoga — same as model solution]
Step 2: [given values list karo with units]
Step 3: [values substitute karo — show the actual numbers]
Step 4: [calculation karo — show arithmetic clearly]
[Step 5 if needed: further simplification]

**Final Answer: [exact value with units]**

IMPORTANT: Keep explanation in Roman Urdu + English. Never use a different formula or method than what the model solution uses. Total length: 180-220 words max.`;

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 900,
      }),
    });

    const data = await groqRes.json();
    const raw  = data.choices?.[0]?.message?.content || '';

    const verdictMatch = raw.match(/VERDICT:\s*(Correct|Partially Correct|Incorrect)/i);
    const verdict  = verdictMatch ? verdictMatch[1] : 'Unknown';
    const feedback = raw.replace(/VERDICT:.*?\n/i, '').replace(/FEEDBACK:\s*/i, '').trim();

    res.json({ verdict, feedback, raw });
  } catch (err) {
    console.error('check-answer error:', err);
    res.status(500).json({ error: 'Failed to check answer' });
  }
});