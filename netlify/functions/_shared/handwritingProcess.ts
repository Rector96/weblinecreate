import { GoogleGenAI } from '@google/genai';

export type HandwritingPage = { mimeType: string; data: string };

export type HandwritingProcessResult = {
  questions: any[];
  diagram_regions: any[];
  page_notes: any[];
  model: string;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Run Gemini vision OCR on exam page images and return structured questions.
 * Throws on hard failures so the caller can mark the queue job failed/retry.
 *
 * Tuned for Nigerian secondary school (JSS/SSS) handwritten exam papers.
 */
export async function processHandwritingPages(
  pages: HandwritingPage[],
  geminiKey: string,
): Promise<HandwritingProcessResult> {
  if (!geminiKey) {
    const err: any = new Error('Gemini vision service is not configured. Set GEMINI_API_KEY in Netlify environment variables.');
    err.status = 503;
    throw err;
  }
  if (!Array.isArray(pages) || pages.length < 1 || pages.length > 8) {
    throw new Error('Scan payload is invalid. Upload between 1 and 8 page photos.');
  }

  const ai = new GoogleGenAI({ apiKey: geminiKey });
  const imageParts = pages.map((page) => ({
    inlineData: { mimeType: page.mimeType, data: page.data },
  }));

  // Education-focused prompt for better fidelity on real teacher handwriting.
  const prompt = `You are an expert examiner reading handwritten Nigerian secondary school examination papers (JSS 1–SSS 3).

Transcribe the handwritten questions from the page images into clean structured JSON.

RULES:
1. Read pages in order. Keep original reading order and original question numbers.
2. Do NOT invent or guess missing text, options, numbers or formulas. Only use what is clearly visible.
3. section "A" = objective/multiple-choice with options A–D. section "B" = theory, structured, essay, calculation or written-response.
4. For section A: put the stem in question_text; put options in option_a–option_d; suggest correct_option only when you are confident, otherwise leave empty.
5. For section B: keep sub-parts (a)(b)(c); capture marks if written; do not invent answers.
6. Preserve maths symbols, units, tables and formulas as accurately as possible.
7. If a diagram is present, add [Diagram: brief description] in question_text and include a diagram_regions entry with normalised 0–1 box when location is clear.
8. Use confidence high/medium/low honestly. Put uncertainties in review_notes.
9. Return ONLY valid JSON. No markdown fences.

JSON shape:
{"questions":[{"section":"A","question_number":1,"question_text":"...","option_a":"","option_b":"","option_c":"","option_d":"","correct_option":"","marks":1,"confidence":"medium","review_notes":[]}],"diagram_regions":[{"section":"A","question_number":1,"page_index":0,"x":0.1,"y":0.2,"width":0.4,"height":0.3,"description":"labelled diagram"}],"page_notes":[]}

Empty diagram_regions if none. Bounding boxes must be 0–1 relative to the full page.`;

  let response: any = null;
  let lastError: any = null;
  let usedModel = '';

  // Restore the models that were already working on this project.
  // gemini-3.8-flash is the current stable high-quality Flash vision model (2026).
  const models = ['gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-flash-latest', 'gemini-3.6-flash'];
  const failures: string[] = [];

  for (const model of models) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        response = await ai.models.generateContent({
          model,
          contents: [{ role: 'user', parts: [{ text: prompt }, ...imageParts] }],
          config: {
            responseMimeType: 'application/json',
            temperature: 0.1,
          },
        });

        const text = typeof response?.text === 'string' ? response.text.trim() : '';
        if (text) {
          usedModel = model;
          break;
        }

        response = null;
        lastError = new Error('Gemini model returned an empty response.');
        failures.push(model + ': empty response');
      } catch (error: any) {
        response = null;
        lastError = error;
        const status = Number(error?.status || error?.code || 0);
        const message = String(error?.message || 'Unknown Gemini error');
        failures.push(model + ': ' + (status ? status + ' ' : '') + message.slice(0, 180));

        console.error('Handwriting vision attempt failed', {
          model,
          attempt,
          status: status || null,
          message: message.slice(0, 240),
        });

        if (
          status === 401 ||
          status === 403 ||
          /API key|authentication|permission denied|unauthorized|invalid api key/i.test(message)
        ) {
          throw error;
        }

        const transient =
          status === 429 ||
          status >= 500 ||
          /timeout|temporarily unavailable|rate.?limit|resource_exhausted|overloaded|high demand/i.test(
            message,
          );

        if (transient && attempt === 1) {
          await sleep(status === 429 ? 1800 : 900);
          continue;
        }

        if (status === 404 || /not found|not supported|invalid model/i.test(message)) {
          break;
        }
      }
    }
    if (response?.text && usedModel) break;
  }

  if (!response?.text || !usedModel) {
    const summary =
      failures.length > 0
        ? failures.join(' | ')
        : String(lastError?.message || 'No model returned a response.');
    const finalError: any = new Error(
      'Gemini could not process the scan with the available vision models. ' + summary,
    );
    finalError.status = Number(lastError?.status || lastError?.code || 0) || 503;
    finalError.modelFailures = failures;
    throw finalError;
  }

  // Strip possible markdown fences some models still return.
  let rawText = String(response.text).trim();
  if (rawText.startsWith('```')) {
    rawText = rawText
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
  }

  let parsed: any;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error(
      'Gemini returned a response, but it was not valid structured JSON. Retry with a clearer photo or fewer pages.',
    );
  }

  const questions = (Array.isArray(parsed.questions) ? parsed.questions : [])
    .filter(
      (q: any) =>
        q &&
        typeof q.question_text === 'string' &&
        q.question_text.trim() &&
        ['A', 'B'].includes(q.section),
    )
    .slice(0, 100)
    .map((q: any, i: number) => ({
      section: q.section,
      question_number:
        Number.isInteger(Number(q.question_number)) && Number(q.question_number) > 0
          ? Number(q.question_number)
          : i + 1,
      question_text: String(q.question_text).slice(0, 5000),
      ...(q.section === 'A'
        ? {
            option_a: String(q.option_a || '').slice(0, 2000),
            option_b: String(q.option_b || '').slice(0, 2000),
            option_c: String(q.option_c || '').slice(0, 2000),
            option_d: String(q.option_d || '').slice(0, 2000),
            ...(['A', 'B', 'C', 'D'].includes(
              String(q.correct_option || '')
                .trim()
                .toUpperCase(),
            )
              ? {
                  correct_option: String(q.correct_option)
                    .trim()
                    .toUpperCase(),
                }
              : {}),
          }
        : {}),
      marks:
        Number.isFinite(Number(q.marks)) && Number(q.marks) > 0
          ? Math.min(100, Number(q.marks))
          : q.section === 'A'
            ? 1
            : 10,
      confidence: ['high', 'medium', 'low'].includes(q.confidence) ? q.confidence : 'medium',
      review_notes: Array.isArray(q.review_notes)
        ? q.review_notes
            .filter((n: any) => typeof n === 'string')
            .slice(0, 8)
            .map((n: string) => n.slice(0, 300))
        : [],
    }));

  if (!questions.length) {
    throw new Error(
      'No questions could be confidently extracted from these pages. Try brighter, sharper photos with the whole page visible.',
    );
  }

  const diagrams = (Array.isArray(parsed.diagram_regions) ? parsed.diagram_regions : [])
    .filter(
      (d: any) =>
        ['A', 'B'].includes(d.section) &&
        Number.isInteger(d.page_index) &&
        d.page_index >= 0 &&
        d.page_index < pages.length &&
        Number.isFinite(d.x) &&
        Number.isFinite(d.y) &&
        Number.isFinite(d.width) &&
        Number.isFinite(d.height) &&
        d.x >= 0 &&
        d.y >= 0 &&
        d.width > 0 &&
        d.height > 0 &&
        d.x + d.width <= 1.001 &&
        d.y + d.height <= 1.001,
    )
    .slice(0, 30);

  return {
    questions,
    diagram_regions: diagrams,
    page_notes: Array.isArray(parsed.page_notes) ? parsed.page_notes.slice(0, 8) : [],
    model: usedModel,
  };
}
