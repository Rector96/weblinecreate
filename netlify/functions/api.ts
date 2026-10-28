import { GoogleGenAI } from '@google/genai';
import { generateExamDraft } from './_shared/examGeneration';

// This file is being restored. Temporary minimal surface so Netlify can deploy.
// Full body will follow in next commit from artifacts/api_FINAL_RESTORE.ts

const geminiApiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();

export default async function handler(req: Request) {
  return new Response(JSON.stringify({ success: false, error: 'API restore in progress' }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const config = { path: ['/api/*'] };
