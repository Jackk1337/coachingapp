/**
 * Environment variable validation utility
 * Validates required environment variables at startup
 */

interface EnvVarConfig {
  name: string;
  required: boolean;
  description?: string;
}

/**
 * Validates environment variables
 * @param configs Array of environment variable configurations
 * @throws Error if required variables are missing
 */
export function validateEnvVars(configs: EnvVarConfig[]): void {
  const missing: string[] = [];
  const warnings: string[] = [];

  for (const config of configs) {
    const value = process.env[config.name];
    
    if (config.required && !value) {
      missing.push(config.name);
    } else if (!config.required && !value && config.description) {
      warnings.push(`${config.name} (optional): ${config.description}`);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      `Please set these variables in your .env.local file or deployment environment.`
    );
  }

  if (warnings.length > 0 && process.env.NODE_ENV !== 'production') {
    console.warn('Optional environment variables not set:', warnings.join(', '));
  }
}

/**
 * Validates Firebase environment variables
 */
export function validateFirebaseEnv(): void {
  validateEnvVars([
    {
      name: 'NEXT_PUBLIC_FIREBASE_API_KEY',
      required: true,
      description: 'Firebase API key',
    },
    {
      name: 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
      required: true,
      description: 'Firebase Auth domain',
    },
    {
      name: 'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
      required: true,
      description: 'Firebase project ID',
    },
    {
      name: 'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
      required: true,
      description: 'Firebase storage bucket',
    },
    {
      name: 'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
      required: true,
      description: 'Firebase messaging sender ID',
    },
    {
      name: 'NEXT_PUBLIC_FIREBASE_APP_ID',
      required: true,
      description: 'Firebase app ID',
    },
  ]);
}

/**
 * Validates Firebase Admin environment variables (server-side only)
 */
export function validateFirebaseAdminEnv(): void {
  // Only validate on server-side
  if (typeof window !== 'undefined') {
    return;
  }

  validateEnvVars([
    {
      name: 'FIREBASE_PROJECT_ID',
      required: true,
      description: 'Firebase project ID for Admin SDK',
    },
    {
      name: 'FIREBASE_CLIENT_EMAIL',
      required: true,
      description: 'Firebase service account email',
    },
    {
      name: 'FIREBASE_PRIVATE_KEY',
      required: true,
      description: 'Firebase service account private key',
    },
  ]);
}

/**
 * Validates Genkit/Google AI environment variables
 */
export function validateGenkitEnv(): void {
  // Only validate on server-side
  if (typeof window !== 'undefined') {
    return;
  }

  validateEnvVars([
    {
      name: 'GOOGLE_GENAI_API_KEY',
      required: false,
      description: 'Google GenAI API key (can also use GEMINI_API_KEY)',
    },
    {
      name: 'GEMINI_API_KEY',
      required: false,
      description: 'Gemini API key (alternative to GOOGLE_GENAI_API_KEY)',
    },
  ]);

  // Check that at least one of the API keys is set
  if (!process.env.GOOGLE_GENAI_API_KEY && !process.env.GEMINI_API_KEY) {
    console.warn('Warning: Neither GOOGLE_GENAI_API_KEY nor GEMINI_API_KEY is set. AI features will not work.');
  }
}

/**
 * Validates rate limiting environment variables (optional)
 */
export function validateRateLimitEnv(): void {
  // Only validate on server-side
  if (typeof window !== 'undefined') {
    return;
  }

  validateEnvVars([
    {
      name: 'UPSTASH_REDIS_REST_URL',
      required: false,
      description: 'Upstash Redis REST URL for rate limiting',
    },
    {
      name: 'UPSTASH_REDIS_REST_TOKEN',
      required: false,
      description: 'Upstash Redis REST token for rate limiting',
    },
  ]);

  // Warn if only one is set
  if (
    (process.env.UPSTASH_REDIS_REST_URL && !process.env.UPSTASH_REDIS_REST_TOKEN) ||
    (!process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
  ) {
    console.warn('Warning: Rate limiting requires both UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN. Rate limiting will be disabled.');
  }
}




