import { z } from 'zod';

/**
 * Validates a date string in YYYY-MM-DD format
 */
export const weekStartDateSchema = z.string().regex(
  /^\d{4}-\d{2}-\d{2}$/,
  'Invalid date format (expected YYYY-MM-DD)'
);

/**
 * Schema for generating coaching message API request
 */
export const generateCoachingMessageSchema = z.object({
  weekStartDate: weekStartDateSchema,
});

/**
 * Validates Firebase UID format (28 characters, alphanumeric)
 */
export const firebaseUidSchema = z.string().length(28).regex(/^[a-zA-Z0-9]+$/);




