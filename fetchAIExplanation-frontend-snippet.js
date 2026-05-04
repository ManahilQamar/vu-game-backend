/* ─────────────────────────────────────────────────────────────────────────────
   Replace the fetchAIExplanation function in your Quiz.jsx with this version.
   It calls your backend proxy instead of Anthropic directly.
   
   In development  → http://localhost:5000/api/explain
   In production   → set REACT_APP_API_URL in your frontend .env
───────────────────────────────────────────────────────────────────────────── */

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';

async function fetchAIExplanation(question, subjectId) {
  const res = await fetch(`${API_BASE}/api/explain`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question:  question.q,
      options:   question.options,
      answer:    question.answer,
      subjectId: subjectId,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Server error');
  }

  const data = await res.json();
  return data.explanation;
}
