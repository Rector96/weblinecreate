import { GoogleGenAI } from '@google/genai';

const groqApiKey = (process.env.GROQ_API_KEY || '').trim();
const geminiApiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();
const geminiAi: any = geminiApiKey ? new GoogleGenAI({ apiKey: geminiApiKey }) : null;
const groqAi: any = groqApiKey
  ? {
      models: {
        generateContent: async ({ model, contents, config }: { model?: string; contents: string; config?: { temperature?: number; responseMimeType?: string } }) => {
          const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { Authorization: 'Bearer ' + groqApiKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: model || 'openai/gpt-oss-120b',
              messages: [
                { role: 'system', content: 'You generate accurate Nigerian secondary-school exam questions. Return valid JSON only when requested.' },
                { role: 'user', content: contents },
              ],
              temperature: config?.temperature ?? 0.3,
              ...(config?.responseMimeType === 'application/json' ? { response_format: { type: 'json_object' } } : {}),
            }),
          });
          const result = await response.json() as any;
          if (!response.ok) {
            const error = new Error(result?.error?.message || 'Groq request failed with status ' + response.status);
            (error as any).status = response.status;
            throw error;
          }
          return { text: result?.choices?.[0]?.message?.content || '' };
        },
      },
    }
  : null;

// Try Groq first when configured, then automatically fall back to Gemini if a key exists.
const PROVIDERS = [
  ...(groqAi ? [{ name: 'Groq', client: groqAi, models: ['openai/gpt-oss-120b', 'openai/gpt-oss-20b'] }] : []),
  ...(geminiAi ? [{ name: 'Gemini', client: geminiAi, models: ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.5-flash-lite'] }] : []),
];
const configuredBatchDelay = Number(process.env.GROQ_BATCH_DELAY_MS);
const BATCH_DELAY_MS = groqApiKey && process.env.EXAM_QUEUE_ENABLED === 'true'
  ? (Number.isFinite(configuredBatchDelay) && configuredBatchDelay >= 0 ? configuredBatchDelay : 40000)
  : 0;
const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

type ExamGenerationInput = {
  subject: string;
  class_name: string;
  term?: string;
  topics?: string;
  num_objectives?: number;
  num_theories?: number;
  difficulty?: string;
  instructions?: string;
};

async function generateSection(prompt: string, sectionName: string) {
  if (!PROVIDERS.length) throw new Error('AI generation is not configured on the server.');
  let lastError: unknown = null;
  for (const provider of PROVIDERS) {
    for (const model of provider.models) {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const response = await provider.client.models.generateContent({
            model,
            contents: prompt,
            config: { responseMimeType: 'application/json', temperature: 0.3 },
          });
          const parsed = JSON.parse(response.text || '');
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            throw new Error('The AI returned an invalid ' + sectionName + ' response.');
          }
          return { model: provider.name + ': ' + model, data: parsed };
        } catch (error: any) {
          lastError = error;
          const errorText = error instanceof Error ? error.message : String(error || '');
          const limited = Number(error?.status || error?.code) === 429 || /rate.?limit|too many requests|tokens per minute/i.test(errorText);
          console.error(provider.name + ' AI ' + sectionName + ' batch failed', error?.status || error?.code || 'unknown status', errorText.slice(0, 200));

          // Keep queued work paced to respect provider limits. In synchronous fallback mode,
          // use short retries so the function does not spend 40 seconds sleeping on each try.
          // A 429 means this model's quota is exhausted for now. Do not retry
          // the same model in the same minute; immediately try the next model/provider.
          if (limited) break;

          // Retry transient non-rate-limit errors briefly before moving to the next model.
          if (attempt < 2) {
            await wait(1200 * (attempt + 1));
            continue;
          }
          // Exhausted this provider/model; try the next configured provider before failing.
          break;
        }
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error('AI ' + sectionName + ' generation failed.');
}

export async function generateExamDraft(input: ExamGenerationInput) {
  const subject = input.subject || 'Mathematics';
  const className = input.class_name || 'SSS 3';
  const term = input.term || 'First Term';
  const topics = input.topics || 'Topics supplied in the school scheme of work';
  const difficulty = input.difficulty || 'Standard';
  const instructions = input.instructions || 'Follow the school curriculum and the supplied topics.';
  const objectiveCount = Math.min(Math.max(Number(input.num_objectives) || 10, 5), 50);
  const theoryCount = Math.min(Math.max(Number(input.num_theories) || 3, 1), 6);

  const sharedContext = [
    'You are an experienced Nigerian secondary-school examination setter with strong knowledge of the NERDC curriculum and West African examination standards.',
    'Match the supplied class level and topics. Use Nigerian/West African contexts where useful and British English spelling.',
    'For Mathematics, Further Mathematics, Physics and Chemistry, use standard LaTeX delimiters for equations, fractions, powers, subscripts, units and chemical formulae. Examples: \\(\\frac{3}{4}x^2\\), \\(v = u + at\\), \\(H_2SO_4\\).',
    'Keep ordinary prose readable. Keep question text separate from answers and marking breakdowns.',
    'Objective options must be plausible and distinct, and the correct option must match the actual solution.',
    'Return valid JSON only, without Markdown fences or introductory text.',
  ].join('\n');

  const objectivePrompt = (count: number) => sharedContext + '\n\nGenerate EXACTLY ' + count + ' Section A objective multiple-choice questions for:' +
    '\nSubject: ' + subject + '\nClass: ' + className + '\nTerm: ' + term + '\nTopics: ' + topics +
    '\nDifficulty: ' + difficulty + '\nTeacher instructions: ' + instructions +
    '\nEach question must have four options, one correct option (A-D), and 1 mark. Return JSON shaped like: ' +
    '{"section_a":[{"question_number":1,"question_text":"Question only","option_a":"A","option_b":"B","option_c":"C","option_d":"D","correct_option":"A","marks":1}]}';

  const theoryPrompt = (count: number) => sharedContext + '\n\nGenerate EXACTLY ' + count + ' Section B theory/essay questions for:' +
    '\nSubject: ' + subject + '\nClass: ' + className + '\nTerm: ' + term + '\nTopics: ' + topics +
    '\nDifficulty: ' + difficulty + '\nTeacher instructions: ' + instructions +
    '\nKeep answers out of question_text. Give each question marks, a complete model answer and a useful step-by-step marking breakdown. Return JSON shaped like: ' +
    '{"section_b":[{"question_number":1,"question_text":"Question prompt only","marks":15,"model_answer":"Complete answer","score_breakdown":"Marks by step","max_score":15}]}';

  const sectionA: any[] = [];
  const sectionB: any[] = [];
  let provider = 'Not selected';
  let completedBatches = 0;
  const generatePacedSection = async (prompt: string, sectionName: string) => {
    if (completedBatches > 0 && BATCH_DELAY_MS > 0) await wait(BATCH_DELAY_MS);
    const result = await generateSection(prompt, sectionName);
    completedBatches += 1;
    return result;
  };

  for (let offset = 0; offset < objectiveCount; offset += 10) {
    const count = Math.min(10, objectiveCount - offset);
    const result = await generatePacedSection(objectivePrompt(count), 'objectives');
    provider = result.model;
    const batch = Array.isArray(result.data.section_a) ? result.data.section_a : [];
    if (batch.length !== count) throw new Error('The AI returned an incomplete objective batch. Please retry.');
    sectionA.push(...batch.map((item: any, index: number) => ({ ...item, question_number: offset + index + 1 })));
  }

  for (let offset = 0; offset < theoryCount; offset += 2) {
    const count = Math.min(2, theoryCount - offset);
    const result = await generatePacedSection(theoryPrompt(count), 'theory');
    provider = result.model;
    const batch = Array.isArray(result.data.section_b) ? result.data.section_b : [];
    if (batch.length !== count) throw new Error('The AI returned an incomplete theory batch. Please retry.');
    sectionB.push(...batch.map((item: any, index: number) => ({ ...item, question_number: offset + index + 1 })));
  }

  return { provider, data: { section_a: sectionA, section_b: sectionB } };
}
