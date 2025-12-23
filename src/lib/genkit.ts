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
export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY,
    }),
  ],
  model: googleAI.model('gemini-3-flash-preview'),
});

export default ai;

