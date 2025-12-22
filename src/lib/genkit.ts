import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';

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
