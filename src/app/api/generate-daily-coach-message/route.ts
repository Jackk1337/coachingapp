import { NextRequest, NextResponse } from 'next/server';
import { collectDailyMessageData } from '@/lib/dailyMessageDataCollector';
import { generateDailyCoachMessage } from '@/lib/genkitFlows';
import { getAdminDb } from '@/lib/firebase-admin';
import { verifyAuth } from '@/lib/api-auth';
import { ratelimit } from '@/lib/ratelimit';
import { Logger } from '@/lib/logger';
import { format } from 'date-fns';

// Maximum request body size: 1MB
const MAX_BODY_SIZE = 1024 * 1024;

/**
 * Verify CSRF protection by checking Origin header
 */
function verifyOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  const host = request.headers.get('host');
  
  // In development, be very permissive
  if (process.env.NODE_ENV === 'development') {
    // Allow requests without origin (same-origin)
    if (!origin) {
      return true;
    }
    
    // Allow any localhost origin
    try {
      const originUrl = new URL(origin);
      const hostname = originUrl.hostname;
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return true;
      }
      // Also check if it matches the request host
      if (host) {
        const requestHostname = host.split(':')[0];
        if (hostname === requestHostname) {
          return true;
        }
      }
    } catch {
      // If parsing fails, allow in development
      return true;
    }
    
    // Fallback: allow if referer is localhost
    if (referer) {
      try {
        const refererUrl = new URL(referer);
        if (refererUrl.hostname === 'localhost' || refererUrl.hostname === '127.0.0.1') {
          return true;
        }
      } catch {
        // Allow in development if we can't verify
        return true;
      }
    }
    
    // Default: allow in development
    return true;
  }
  
  // Production: stricter checks
  // Allow same-origin requests (no Origin header)
  if (!origin) {
    if (referer && host) {
      try {
        const refererUrl = new URL(referer);
        const refererHost = refererUrl.host;
        // Check if referer matches request host
        if (refererHost === host || refererUrl.hostname === host.split(':')[0]) {
          return true;
        }
      } catch {
        // If we can't verify, deny in production
        return false;
      }
    }
    // No origin and no referer - deny in production
    return false;
  }
  
  // Check origin against allowed domains
  try {
    const originUrl = new URL(origin);
    const hostname = originUrl.hostname;
    
    // Check if origin matches request host (same-origin)
    if (host) {
      const requestHostname = host.split(':')[0];
      if (hostname === requestHostname) {
        return true;
      }
    }
    
    // Check against allowed domains
    const allowedDomains = [
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      process.env.VERCEL_URL ? `${process.env.VERCEL_URL}` : undefined,
    ].filter(Boolean);
    
    return allowedDomains.some(domain => hostname.includes(domain || ''));
  } catch {
    // If we can't parse, deny in production
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

    // Parse optional request body for date (defaults to today)
    let targetDate: string | undefined;
    try {
      const body = await request.json().catch(() => ({}));
      if (body && typeof body.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
        targetDate = body.date;
      }
    } catch (error) {
      // No body or invalid JSON - that's fine, we'll use today
    }

    // Use provided date or today
    const date = targetDate || format(new Date(), 'yyyy-MM-dd');
    const docId = `${userId}_${date}`;

    // Check if message already exists for today
    const adminDb = getAdminDb();
    const existingMessageRef = adminDb.collection('daily_coach_messages').doc(docId);
    const existingMessageSnap = await existingMessageRef.get();

    if (existingMessageSnap.exists) {
      logger.info('Daily message already exists', { userId, date });
      const existingData = existingMessageSnap.data();
      return NextResponse.json({
        success: true,
        message: existingData?.message || '',
        date,
        coachName: existingData?.coachName || 'AI Coach',
        requestId,
      }, {
        headers: {
          'X-Request-ID': requestId,
        },
      });
    }

    // Collect daily message data
    logger.info('Collecting daily message data', { userId, date });
    const dailyData = await collectDailyMessageData(userId, date);

    if (!dailyData.userProfile) {
      logger.warn('User profile not found', { userId });
      return NextResponse.json(
        { error: 'User profile not found', requestId },
        { status: 404 }
      );
    }

    // Check if user has selected a coach
    // User has a coach if coachId exists and is not empty, and skipCoachReason is not set
    const coachId = dailyData.userProfile?.coachId;
    const skipCoachReason = (dailyData.userProfile as any)?.skipCoachReason;
    const hasCoach = coachId && coachId.trim() !== '' && !skipCoachReason;

    if (!hasCoach) {
      logger.info('User has not selected a coach, skipping message generation', { userId });
      return NextResponse.json(
        { error: 'No coach selected', message: 'Please select an AI coach to receive daily messages', requestId },
        { status: 400 }
      );
    }

    // Fetch coach name, persona, and custom intensity levels from coaches collection
    let coachName = 'AI Coach';
    let coachPersona = '';
    let customIntensityLevels: { Low?: string; Medium?: string; High?: string; Extreme?: string } | undefined;
    
    if (coachId && coachId !== 'AI Coach') {
      try {
        // First try default coaches collection
        const coachSnap = await adminDb.collection('coaches').doc(coachId).get();
        if (coachSnap.exists) {
          const coachData = coachSnap.data();
          coachName = coachData?.coach_name || coachId;
          coachPersona = coachData?.coach_persona || '';
        } else {
          // Try user_coaches collection
          const userCoachSnap = await adminDb.collection('user_coaches').doc(coachId).get();
          if (userCoachSnap.exists) {
            const userCoachData = userCoachSnap.data();
            coachName = userCoachData?.coach_name || coachId;
            coachPersona = userCoachData?.coach_persona || '';
            customIntensityLevels = userCoachData?.intensityLevels;
          } else {
            // Try community_coaches collection
            const communityCoachSnap = await adminDb.collection('community_coaches').doc(coachId).get();
            if (communityCoachSnap.exists) {
              const communityCoachData = communityCoachSnap.data();
              coachName = communityCoachData?.coach_name || coachId;
              coachPersona = communityCoachData?.coach_persona || '';
              customIntensityLevels = communityCoachData?.intensityLevels;
            }
          }
        }
      } catch (error) {
        logger.error('Error fetching coach data', error, { coachId });
        // Fallback to coachId if fetch fails
        coachName = coachId;
      }
    }

    // Generate daily coaching message using AI
    let message: string;
    
    try {
      logger.info('Generating daily coach message', { userId, coachId, coachName, date });
      message = await generateDailyCoachMessage(dailyData, coachName, coachPersona, customIntensityLevels);
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
    logger.info('Saving daily message to Firestore', { userId, date });
    await existingMessageRef.set({
      userId,
      message,
      date,
      coachId,
      coachName,
      createdAt: new Date(),
    });

    logger.info('Daily coach message generated successfully', {
      userId,
      date,
      messageId: docId,
    });

    return NextResponse.json({
      success: true,
      message,
      date,
      coachName,
      requestId,
    }, {
      headers: {
        'X-Request-ID': requestId,
      },
    });
  } catch (error) {
    logger.error('Error generating daily coach message', error);
    
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
        error: 'Failed to generate daily coach message',
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

