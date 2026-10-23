import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
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

      // Offline curriculum fallback if no key or all attempts fail
      const fallbackA = Array.from({ length: safeObjCount }, (_, i) => ({
        question_number: i + 1,
        question_text: `[${subject} Q${i + 1}] Which of the following is correct regarding ${topics || 'the syllabus'} for ${class_name}?`,
        option_a: 'Primary standard definition statement',
        option_b: 'Inverse relationship variable',
        option_c: 'Empirical condition in Nigerian ecosystems',
        option_d: 'Non-applicable baseline',
        correct_option: ['A', 'B', 'C', 'D'][i % 4],
        marks: 1,
      }));

      const fallbackB = Array.from({ length: safeTheoryCount }, (_, i) => ({
        question_number: i + 1,
        question_text: `(a) Clearly define ${topics || subject} in relation to ${class_name}.\n(b) Solve with full working showing intermediate steps.\n(c) State two practical applications in Nigerian industry.`,
        marks: 15,
        model_answer: '(a) Clear formal definition (3 mks).\n(b) Step-by-step substitution and solution (8 mks).\n(c) Two valid real-world applications (4 mks). Total = 15 Marks.',
        score_breakdown: 'Part (a): 3 mks; Part (b): 8 mks; Part (c): 4 mks.',
        max_score: 15,
      }));

      return new Response(
        JSON.stringify({
          success: true,
          provider: 'curriculum-fallback',
          data: { section_a: fallbackA, section_b: fallbackB },
        }),
        { status: 200, headers: corsHeaders }
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

      const fallbackSingle = isObjective
        ? {
            question_number,
            question_text: `[${subject}] According to WAEC standard curriculum in ${class_name}, which of the following is correct regarding ${topics || 'the syllabus'}?`,
            option_a: 'Primary theorem statement with standard units',
            option_b: 'Alternative reciprocal property',
            option_c: 'Inverse proportionality under standard laboratory conditions',
            option_d: 'Non-applicable empirical variable',
            correct_option: 'A',
            marks: 1,
          }
        : {
            question_number,
            question_text: `(a) Clearly state the fundamental rule governing ${topics || subject} in ${class_name}.\n(b) Solve for the unknown magnitude if the initial quantity is increased by 50%.\n(c) List two safety or standard industrial practices related to this topic in Nigeria.`,
            marks: 15,
            model_answer: '(a) Statement of rule (3 mks).\n(b) Calculation with 1.5 multiplier (7 mks).\n(c) Practical industrial applications in Nigeria (5 mks). Total = 15 Marks.',
            score_breakdown: 'Part (a): 3 mks; Part (b): 7 mks; Part (c): 5 mks.',
            max_score: 15,
          };

      return new Response(JSON.stringify({ success: true, data: fallbackSingle }), {
        status: 200,
        headers: corsHeaders,
      });
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

      const generated = [];
      for (let i = 0; i < safeCount; i++) {
        const qNum = Number(start_number) + i;
        if (isObjective) {
          generated.push({
            question_number: qNum,
            question_text: `[${subject} Q${qNum}] Which principle in ${class_name} corresponds to ${topics || 'the curriculum'}?`,
            option_a: `Verified baseline property A`,
            option_b: `Empirical observation B`,
            option_c: `Inverted theorem C`,
            option_d: `Theoretical constant D`,
            correct_option: ['A', 'B', 'C', 'D'][i % 4],
            marks: 1,
          });
        } else {
          generated.push({
            question_number: qNum,
            question_text: `(a) Define the concept of ${topics || subject} as applied in ${class_name}.\n(b) Calculate the final equilibrium given standard values.\n(c) Discuss its significance in Nigerian socio-economic development.`,
            marks: 15,
            model_answer: 'Full step-by-step solution according to WAEC standards.',
            score_breakdown: 'Part (a): 4 mks; Part (b): 7 mks; Part (c): 4 mks.',
            max_score: 15,
          });
        }
      }

      return new Response(JSON.stringify({ success: true, data: generated }), {
        status: 200,
        headers: corsHeaders,
      });
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
