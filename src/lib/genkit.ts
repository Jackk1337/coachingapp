import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import { validateGenkitEnv } from './env-validation';

// Validate environment variables at startup (only on server-side)
if (typeof window === 'undefined') {
  try {
    validateGenkitEnv();
  } catch (error) {
    // In development, log the error but don't crash
    if (process.env.NODE_ENV === 'development') {
      console.warn('Genkit environment validation warning:', error instanceof Error ? error.message : String(error));
    }
  }
}

// Configure Genkit with Google Gemini
// Using gemini-3-flash-preview model
const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY;
if (!apiKey && typeof window === 'undefined') {
  console.warn('Warning: GOOGLE_GENAI_API_KEY or GEMINI_API_KEY is not set. AI features will not work.');
}

export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: apiKey,
    }),
  ],
  model: googleAI.model('gemini-3-flash-preview'),
});

export default ai;

