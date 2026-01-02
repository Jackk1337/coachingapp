# Security Fixes Implementation Guide

This guide provides step-by-step instructions for implementing the critical security fixes identified in the security review.

## Priority 1: Fix API Route Authentication (CRITICAL)

### Step 1: Install Firebase Admin SDK

```bash
npm install firebase-admin
```

### Step 2: Create Firebase Admin Configuration

Create `src/lib/firebase-admin.ts`:

```typescript
import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';

let app: App;
let adminAuth: Auth;

if (!getApps().length) {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  
  if (!privateKey || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PROJECT_ID) {
    throw new Error('Missing Firebase Admin environment variables');
  }

  app = initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: privateKey,
    }),
  });
} else {
  app = getApps()[0];
}

adminAuth = getAuth(app);

export { adminAuth };
```

### Step 3: Add Environment Variables

Add to your `.env.local` and Vercel:

```
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

**To get these values:**
1. Go to Firebase Console → Project Settings → Service Accounts
2. Click "Generate New Private Key"
3. Download the JSON file
4. Extract the values from the JSON

### Step 4: Create Authentication Helper

Create `src/lib/api-auth.ts`:

```typescript
import { NextRequest } from 'next/server';
import { adminAuth } from './firebase-admin';

export async function verifyAuth(request: NextRequest): Promise<string> {
  const authHeader = request.headers.get('authorization');
  
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Unauthorized: Missing or invalid authorization header');
  }
  
  const idToken = authHeader.split('Bearer ')[1];
  
  try {
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    return decodedToken.uid;
  } catch (error) {
    throw new Error('Unauthorized: Invalid token');
  }
}
```

### Step 5: Update API Route

Update `src/app/api/generate-coaching-message/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { collectWeeklyData } from '@/lib/weeklyDataCollector';
import { generateCoachingMessage } from '@/lib/genkitFlows';
import { db } from '@/lib/firebase';
import { collection, addDoc, Timestamp, doc, getDoc } from 'firebase/firestore';
import { verifyAuth } from '@/lib/api-auth';
import { z } from 'zod';

const requestSchema = z.object({
  weekStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (expected YYYY-MM-DD)'),
});

export async function POST(request: NextRequest) {
  try {
    // Verify authentication and get userId from token
    const userId = await verifyAuth(request);
    
    // Parse and validate request body
    const body = await request.json();
    const { weekStartDate } = requestSchema.parse(body);

    // Collect all weekly data (now using verified userId)
    const weeklyData = await collectWeeklyData(userId, weekStartDate);

    // Check if weekly checkin exists
    if (!weeklyData.weeklyCheckin) {
      return NextResponse.json(
        { error: 'Weekly checkin not found for the specified week' },
        { status: 404 }
      );
    }

    // Use coachId from profile, or default to 'AI Coach'
    const coachId = weeklyData.userProfile?.coachId || 'AI Coach';
    
    // Fetch coach name and persona from coaches collection
    let coachName = 'AI Coach';
    let coachPersona = '';
    if (coachId && coachId !== 'AI Coach') {
      try {
        const coachRef = doc(db, 'coaches', coachId);
        const coachSnap = await getDoc(coachRef);
        if (coachSnap.exists()) {
          const coachData = coachSnap.data();
          coachName = coachData.coach_name || coachId;
          coachPersona = coachData.coach_persona || '';
        }
      } catch (error) {
        console.error('Error fetching coach data:', error);
        coachName = coachId;
      }
    }

    // Generate coaching message using AI
    let subject: string;
    let messageBody: string;
    
    try {
      const result = await generateCoachingMessage(weeklyData, coachName, coachPersona);
      subject = result.subject;
      messageBody = result.body;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStatus = (error as { status?: number })?.status;
      const isRateLimit = errorMessage.toLowerCase().includes('rate limit') ||
                         errorMessage.toLowerCase().includes('too many requests') ||
                         errorStatus === 429;
      
      if (isRateLimit) {
        return NextResponse.json(
          {
            error: 'Rate limit exceeded',
            message: 'The AI service is currently experiencing high demand. Please try again in a few minutes.',
            retryAfter: 60,
          },
          { status: 429 }
        );
      }
      
      throw error;
    }

    // Save message to Firestore
    const messageRef = await addDoc(collection(db, 'messages'), {
      userId,
      subject,
      body: messageBody,
      coach_id: coachId,
      coach_name: coachName,
      read: false,
      createdAt: Timestamp.now(),
    });

    return NextResponse.json({
      success: true,
      messageId: messageRef.id,
      subject,
    });
  } catch (error) {
    console.error('Error generating coaching message:', error);
    
    const isDev = process.env.NODE_ENV === 'development';
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Don't expose internal errors in production
    if (errorMessage.includes('Unauthorized')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      {
        error: 'Failed to generate coaching message',
        ...(isDev && { details: errorMessage }),
      },
      { status: 500 }
    );
  }
}
```

### Step 6: Update Client-Side API Calls

Update any client-side code that calls this API to include the auth token:

```typescript
// Example: In your component/page
const response = await fetch('/api/generate-coaching-message', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${await user.getIdToken()}`,
  },
  body: JSON.stringify({
    weekStartDate: '2024-01-01',
  }),
});
```

## Priority 2: Deploy Firestore Security Rules

### Step 1: Install Firebase CLI (if not already installed)

```bash
npm install -g firebase-tools
```

### Step 2: Initialize Firebase (if not already done)

```bash
firebase init firestore
```

### Step 3: Deploy Rules

```bash
firebase deploy --only firestore:rules
```

Or manually copy `firestore.rules` to Firebase Console → Firestore Database → Rules

## Priority 3: Add Rate Limiting

### Step 1: Install Rate Limiting Library

```bash
npm install @upstash/ratelimit @upstash/redis
```

### Step 2: Set Up Upstash Redis (or use alternative)

1. Create account at https://upstash.com
2. Create Redis database
3. Get REST URL and token

### Step 3: Add Environment Variables

```
UPSTASH_REDIS_REST_URL=your-url
UPSTASH_REDIS_REST_TOKEN=your-token
```

### Step 4: Create Rate Limiter

Create `src/lib/ratelimit.ts`:

```typescript
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "1 h"),
  analytics: true,
});
```

### Step 5: Add to API Route

```typescript
import { ratelimit } from '@/lib/ratelimit';

export async function POST(request: NextRequest) {
  const userId = await verifyAuth(request);
  
  const { success, limit, reset, remaining } = await ratelimit.limit(userId);
  
  if (!success) {
    return NextResponse.json(
      { 
        error: 'Rate limit exceeded',
        retryAfter: Math.ceil((reset - Date.now()) / 1000),
      },
      { 
        status: 429,
        headers: {
          'X-RateLimit-Limit': limit.toString(),
          'X-RateLimit-Remaining': remaining.toString(),
          'X-RateLimit-Reset': reset.toString(),
        },
      }
    );
  }
  
  // ... rest of code
}
```

## Priority 4: Add Security Headers

Update `next.config.ts`:

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin'
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "font-src 'self' data:",
              "connect-src 'self' https://*.firebaseapp.com https://*.googleapis.com https://*.firebaseio.com",
              "frame-src 'self'",
            ].join('; ')
          },
        ],
      },
    ];
  },
};

export default nextConfig;
```

## Priority 5: Add Input Validation

### Step 1: Install Zod

```bash
npm install zod
```

### Step 2: Create Validation Schemas

Create `src/lib/validation.ts`:

```typescript
import { z } from 'zod';

export const weekStartDateSchema = z.string().regex(
  /^\d{4}-\d{2}-\d{2}$/,
  'Invalid date format (expected YYYY-MM-DD)'
);

export const generateCoachingMessageSchema = z.object({
  weekStartDate: weekStartDateSchema,
});

export const firebaseUidSchema = z.string().length(28).regex(/^[a-zA-Z0-9]+$/);
```

### Step 3: Use in API Routes

```typescript
import { generateCoachingMessageSchema } from '@/lib/validation';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = generateCoachingMessageSchema.parse(body);
    // Use validated.weekStartDate
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }
    throw error;
  }
}
```

## Testing Checklist

After implementing fixes, test:

- [ ] API route rejects requests without auth token
- [ ] API route rejects requests with invalid token
- [ ] API route rejects requests with token for different user
- [ ] Rate limiting works correctly
- [ ] Input validation rejects invalid dates
- [ ] Security headers are present in responses
- [ ] Firestore rules prevent unauthorized access
- [ ] Error messages don't leak sensitive info in production

## Deployment Checklist

- [ ] Add Firebase Admin environment variables to Vercel
- [ ] Add rate limiting environment variables to Vercel
- [ ] Deploy Firestore security rules
- [ ] Test authentication flow in production
- [ ] Monitor error logs for authentication failures
- [ ] Set up alerts for rate limit violations






