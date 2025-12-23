import { NextRequest, NextResponse } from 'next/server';
import { collectWeeklyData } from '@/lib/weeklyDataCollector';
import { generateCoachingMessage } from '@/lib/genkitFlows';
import { getAdminDb } from '@/lib/firebase-admin';
import { verifyAuth } from '@/lib/api-auth';
import { generateCoachingMessageSchema } from '@/lib/validation';
import { ratelimit } from '@/lib/ratelimit';
import { Logger } from '@/lib/logger';
import { z } from 'zod';

// Maximum request body size: 1MB
const MAX_BODY_SIZE = 1024 * 1024;

/**
 * Verify CSRF protection by checking Origin header
 */
function verifyOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  
  // Allow requests from same origin (no Origin header) or localhost in development
  if (!origin) {
    // Check referer as fallback
    if (referer) {
      const refererUrl = new URL(referer);
      const hostname = refererUrl.hostname;
      // Allow localhost and same-origin requests
      return hostname === 'localhost' || hostname === '127.0.0.1' || hostname.includes(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '');
    }
    return true; // Same-origin request
  }
  
  try {
    const originUrl = new URL(origin);
    const hostname = originUrl.hostname;
    
    // In development, allow localhost
    if (process.env.NODE_ENV === 'development') {
      return hostname === 'localhost' || hostname === '127.0.0.1';
    }
    
    // In production, verify against expected domains
    // Allow requests from Firebase Auth domain or your app domain
    const allowedDomains = [
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      process.env.VERCEL_URL ? `${process.env.VERCEL_URL}` : undefined,
    ].filter(Boolean);
    
    return allowedDomains.some(domain => hostname.includes(domain || ''));
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const logger = new Logger();
  const requestId = logger.getRequestId();
  
  try {
    // Check request body size
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
      logger.security('Request body too large', { contentLength });
      return NextResponse.json(
        { error: 'Request body too large', requestId },
        { status: 413 }
      );
    }

    // Verify CSRF protection
    if (!verifyOrigin(request)) {
      logger.security('CSRF validation failed', {
        origin: request.headers.get('origin'),
        referer: request.headers.get('referer'),
      });
      return NextResponse.json(
        { error: 'Forbidden', requestId },
        { status: 403 }
      );
    }

    // Verify authentication and get userId from token
    let userId: string;
    try {
      userId = await verifyAuth(request);
      logger.info('Authentication successful', { userId });
    } catch (authError) {
      logger.security('Authentication failed', { error: authError instanceof Error ? authError.message : String(authError) });
      return NextResponse.json(
        { error: 'Unauthorized', requestId },
        { status: 401 }
      );
    }

    // Apply rate limiting
    if (ratelimit) {
      const rateLimitResult = await ratelimit.limit(userId);
      if (!rateLimitResult.success) {
        logger.security('Rate limit exceeded', {
          userId,
          limit: rateLimitResult.limit,
          remaining: rateLimitResult.remaining,
          reset: rateLimitResult.reset,
        });
        return NextResponse.json(
          {
            error: 'Rate limit exceeded',
            message: 'Too many requests. Please try again later.',
            retryAfter: Math.ceil((rateLimitResult.reset - Date.now()) / 1000),
            requestId,
          },
          {
            status: 429,
            headers: {
              'X-RateLimit-Limit': rateLimitResult.limit.toString(),
              'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
              'X-RateLimit-Reset': rateLimitResult.reset.toString(),
              'X-Request-ID': requestId,
            },
          }
        );
      }
      logger.info('Rate limit check passed', {
        userId,
        remaining: rateLimitResult.remaining,
      });
    }

    // Parse and validate request body
    let body: unknown;
    try {
      body = await request.json();
    } catch (error) {
      logger.error('Failed to parse request body', error);
      return NextResponse.json(
        { error: 'Invalid JSON in request body', requestId },
        { status: 400 }
      );
    }

    let validatedData: z.infer<typeof generateCoachingMessageSchema>;
    try {
      validatedData = generateCoachingMessageSchema.parse(body);
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.warn('Validation failed', { errors: error.issues });
        return NextResponse.json(
          {
            error: 'Validation failed',
            details: error.issues,
            requestId,
          },
          { status: 400 }
        );
      }
      throw error;
    }

    const { weekStartDate } = validatedData;

    // Collect all weekly data (now using verified userId)
    logger.info('Collecting weekly data', { userId, weekStartDate });
    const weeklyData = await collectWeeklyData(userId, weekStartDate);

    // Check if weekly checkin exists
    if (!weeklyData.weeklyCheckin) {
      logger.warn('Weekly checkin not found', { userId, weekStartDate });
      return NextResponse.json(
        { error: 'Weekly checkin not found for the specified week', requestId },
        { status: 404 }
      );
    }

    // Use coachId from profile, or default to 'AI Coach'
    const coachId = weeklyData.userProfile?.coachId || 'AI Coach';
    
    // Fetch coach name and persona from coaches collection BEFORE generating message
    const adminDb = getAdminDb();
    let coachName = 'AI Coach';
    let coachPersona = '';
    if (coachId && coachId !== 'AI Coach') {
      try {
        const coachSnap = await adminDb.collection('coaches').doc(coachId).get();
        if (coachSnap.exists) {
          const coachData = coachSnap.data();
          coachName = coachData?.coach_name || coachId;
          coachPersona = coachData?.coach_persona || '';
        }
      } catch (error) {
        logger.error('Error fetching coach data', error, { coachId });
        // Fallback to coachId if fetch fails
        coachName = coachId;
      }
    }

    // Generate coaching message using AI (pass coachName and coachPersona)
    let subject: string;
    let messageBody: string;
    
    try {
      logger.info('Generating coaching message', { userId, coachId, coachName });
      const result = await generateCoachingMessage(weeklyData, coachName, coachPersona);
      subject = result.subject;
      messageBody = result.body;
    } catch (error: unknown) {
      // Check if it's a rate limit error
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStatus = (error as { status?: number })?.status;
      const isRateLimit = errorMessage.toLowerCase().includes('rate limit') ||
                         errorMessage.toLowerCase().includes('too many requests') ||
                         errorStatus === 429;
      
      if (isRateLimit) {
        logger.warn('AI service rate limit', { userId });
        return NextResponse.json(
          {
            error: 'Rate limit exceeded',
            message: 'The AI service is currently experiencing high demand. Please try again in a few minutes.',
            retryAfter: 60,
            requestId,
          },
          { status: 429 }
        );
      }
      
      // Re-throw other errors to be handled by outer catch
      throw error;
    }

    // Save message to Firestore
    logger.info('Saving message to Firestore', { userId });
    const messageRef = await adminDb.collection('messages').add({
      userId,
      subject,
      body: messageBody,
      coach_id: coachId,
      coach_name: coachName,
      read: false,
      createdAt: new Date(),
    });

    logger.info('Coaching message generated successfully', {
      userId,
      messageId: messageRef.id,
    });

    return NextResponse.json({
      success: true,
      messageId: messageRef.id,
      subject,
      requestId,
    }, {
      headers: {
        'X-Request-ID': requestId,
      },
    });
  } catch (error) {
    logger.error('Error generating coaching message', error);
    
    const isDev = process.env.NODE_ENV === 'development';
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Don't expose internal errors in production
    if (errorMessage.includes('Unauthorized')) {
      return NextResponse.json(
        { error: 'Unauthorized', requestId },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      {
        error: 'Failed to generate coaching message',
        ...(isDev && { details: errorMessage }),
        requestId,
      },
      {
        status: 500,
        headers: {
          'X-Request-ID': requestId,
        },
      }
    );
  }
}
