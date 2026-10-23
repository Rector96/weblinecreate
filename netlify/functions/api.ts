import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY; // Server-side secret only; never expose Gemini keys via VITE_ variables.
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

// Best models for high accuracy and ultra-low cost / free tier
const MODELS = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.5-flash-lite'];

export default async (req: Request) => {
  const url = new URL(req.url);
  const pathname = url.pathname;

  // Set CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // 1. GENERATE FULL EXAM QUESTIONS
  if (pathname.endsWith('/generate-questions') && req.method === 'POST') {
    try {
      const body = await req.json();
      const {
        subject = 'General Mathematics',
        class_name = 'SSS 3',
        term = 'First Term',
        topics = 'Standard Nigerian secondary curriculum',
        num_objectives = 10,
        num_theories = 3,
        difficulty = 'Standard WAEC/JAMB',
        instructions = '',
      } = body;

      const safeObjCount = Math.min(Math.max(Number(num_objectives) || 10, 5), 50);
      const safeTheoryCount = Math.min(Math.max(Number(num_theories) || 3, 1), 6);

      const promptText = `
You are a senior West African Examinations Council (WAEC) and JAMB Chief Examiner with 20+ years setting Nigerian secondary school final papers.

GENERATE AN AUTHENTIC NIGERIAN EXAMINATION PAPER FOR:
- Subject: ${subject}
- Class Level: ${class_name} (Nigerian Secondary School)
- Academic Term: ${term}
- Target Topics: ${topics}
- Academic Rigor: ${difficulty}
- General Instructions: ${instructions || 'Answer all questions in Section A and any three questions in Section B.'}

REQUIREMENTS:
1. Generate EXACTLY ${safeObjCount} Section A Objective (Multiple Choice) questions.
   - Each objective question MUST have 4 realistic options: option_a, option_b, option_c, option_d.
   - Provide the correct_option which MUST be one of 'A', 'B', 'C', or 'D'.
   - Marks for each objective question must be 1.
2. Generate EXACTLY ${safeTheoryCount} Section B Essay/Theory questions.
   - Each theory question should reflect authentic WAEC style (with sub-parts like (a), (b) if applicable).
   - Allocate marks (e.g. 10 to 15 marks per question).
   - Provide a thorough model_answer showing step-by-step solutions or detailed essay points.
   - Provide an exact score_breakdown (e.g. "Step 1 formula: 2 mks, Substitution: 3 mks, Correct unit: 1 mk").
   - max_score: total marks for this question.

You MUST respond strictly with a valid JSON object matching this schema:
{
  "section_a": [
    {
      "question_number": 1,
      "question_text": "...",
      "option_a": "...",
      "option_b": "...",
      "option_c": "...",
      "option_d": "...",
      "correct_option": "A",
      "marks": 1
    }
  ],
  "section_b": [
    {
      "question_number": 1,
      "question_text": "...",
      "marks": 15,
      "model_answer": "...",
      "score_breakdown": "...",
      "max_score": 15
    }
  ]
}
`;

      if (ai) {
        for (const model of MODELS) {
          try {
            const response = await ai.models.generateContent({
              model,
              contents: promptText,
              config: {
                responseMimeType: 'application/json',
                temperature: 0.3,
              },
            });
            const rawJson = response.text || '';
            const parsed = JSON.parse(rawJson);
            return new Response(JSON.stringify({ success: true, provider: model, data: parsed }), {
              status: 200,
              headers: corsHeaders,
            });
          } catch (modelErr: any) {
            console.warn(`Netlify function model ${model} failed, trying next:`, modelErr?.message);
          }
        }
      }

      return new Response(
        JSON.stringify({ success: false, error: 'AI generation is unavailable. Configure GEMINI_API_KEY on the server and try again; placeholder questions are never returned as real exam content.' }),
        { status: 503, headers: corsHeaders }
      );
    } catch (e: any) {
      return new Response(JSON.stringify({ success: false, error: e?.message }), {
        status: 500,
        headers: corsHeaders,
      });
    }
  }

  // 2. REGENERATE SINGLE QUESTION
  if (pathname.endsWith('/regenerate-single-question') && req.method === 'POST') {
    try {
      const body = await req.json();
      const { subject, class_name, section = 'A', question_number = 1, topics = '' } = body;
      const isObjective = section === 'A';

      const promptText = `
You are a senior WAEC Chief Examiner. Generate a SINGLE FRESH ${isObjective ? 'Objective (Multiple Choice)' : 'Theory/Essay'} question for:
- Subject: ${subject}
- Class: ${class_name}
- Topics: ${topics || 'Standard Nigerian curriculum'}

${
  isObjective
    ? `Format as JSON:
{
  "question_number": ${question_number},
  "question_text": "...",
  "option_a": "...",
  "option_b": "...",
  "option_c": "...",
  "option_d": "...",
  "correct_option": "A",
  "marks": 1
}`
    : `Format as JSON:
{
  "question_number": ${question_number},
  "question_text": "(a) ...\\n(b) ...",
  "marks": 15,
  "model_answer": "...",
  "score_breakdown": "Part (a): 5 mks, Part (b): 10 mks",
  "max_score": 15
}`
}
Return STRICT JSON ONLY.`;

      if (ai) {
        for (const model of MODELS) {
          try {
            const response = await ai.models.generateContent({
              model,
              contents: promptText,
              config: { responseMimeType: 'application/json', temperature: 0.7 },
            });
            const parsed = JSON.parse(response.text || '{}');
            return new Response(JSON.stringify({ success: true, data: parsed }), {
              status: 200,
              headers: corsHeaders,
            });
          } catch (err: any) {
            console.warn(`Netlify single regen model ${model} error:`, err?.message);
          }
        }
      }

      return new Response(
        JSON.stringify({ success: false, error: 'Question regeneration is unavailable. Configure GEMINI_API_KEY on the server and try again.' }),
        { status: 503, headers: corsHeaders }
      );
    } catch (e: any) {
      return new Response(JSON.stringify({ success: false, error: e?.message }), {
        status: 500,
        headers: corsHeaders,
      });
    }
  }

  // 3. GENERATE MORE QUESTIONS
  if (pathname.endsWith('/generate-more-questions') && req.method === 'POST') {
    try {
      const body = await req.json();
      const { subject, class_name, section = 'A', count = 5, start_number = 1, topics = '' } = body;
      const safeCount = Math.min(Math.max(Number(count) || 5, 1), 20);
      const isObjective = section === 'A';

      const promptText = `
You are a senior WAEC Chief Examiner. Generate EXACTLY ${safeCount} NEW ${isObjective ? 'Objective Multiple Choice' : 'Theory'} questions for:
- Subject: ${subject}
- Class: ${class_name}
- Section: ${section}
- Topics: ${topics || 'Nigerian secondary syllabus'}
- Starting Question Number: ${start_number}

Respond strictly with a JSON object:
{
  "questions": [
    ${
      isObjective
        ? `{"question_number": ${start_number}, "question_text": "...", "option_a": "...", "option_b": "...", "option_c": "...", "option_d": "...", "correct_option": "A", "marks": 1}`
        : `{"question_number": ${start_number}, "question_text": "...", "marks": 15, "model_answer": "...", "score_breakdown": "...", "max_score": 15}`
    }
  ]
}`;

      if (ai) {
        for (const model of MODELS) {
          try {
            const response = await ai.models.generateContent({
              model,
              contents: promptText,
              config: { responseMimeType: 'application/json', temperature: 0.5 },
            });
            const parsed = JSON.parse(response.text || '{}');
            return new Response(JSON.stringify({ success: true, data: parsed.questions || [] }), {
              status: 200,
              headers: corsHeaders,
            });
          } catch (e: any) {
            console.warn(`Netlify more questions model ${model} error:`, e?.message);
          }
        }
      }

      return new Response(
        JSON.stringify({ success: false, error: 'Question generation is unavailable. Configure GEMINI_API_KEY on the server and try again.' }),
        { status: 503, headers: corsHeaders }
      );
    } catch (e: any) {
      return new Response(JSON.stringify({ success: false, error: e?.message }), {
        status: 500,
        headers: corsHeaders,
      });
    }
  }

  return new Response(JSON.stringify({ error: 'Endpoint not found' }), {
    status: 404,
    headers: corsHeaders,
  });
};

export const config = {
  path: ['/api/generate-questions', '/api/regenerate-single-question', '/api/generate-more-questions'],
};
