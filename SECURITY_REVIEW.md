# Security Review Report
**Application:** Coaching App  
**Review Date:** 2024  
**Reviewer:** Security Consultant  
**Severity Levels:** 🔴 Critical | 🟠 High | 🟡 Medium | 🟢 Low

---

## Executive Summary

This security review identified **1 Critical**, **4 High**, **5 Medium**, and **3 Low** severity security issues. The most critical finding is that API routes do not verify user authentication, allowing unauthorized access to user data. Immediate action is required to address the critical and high-severity issues.

---

## 🔴 CRITICAL ISSUES

### 1. API Route Authentication Bypass (IDOR Vulnerability)
**Severity:** 🔴 Critical  
**Location:** `src/app/api/generate-coaching-message/route.ts`  
**CWE:** CWE-639 (Authorization Bypass Through User-Controlled Key)

**Issue:**
The `/api/generate-coaching-message` API route accepts `userId` from the request body without verifying that the authenticated user matches that `userId`. This allows any authenticated user to:
- Access any other user's weekly data (checkins, food diaries, workout logs, etc.)
- Generate coaching messages for other users
- Potentially access sensitive health and fitness data

**Vulnerable Code:**
```typescript:7:20:src/app/api/generate-coaching-message/route.ts
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, weekStartDate } = body;

    if (!userId || !weekStartDate) {
      return NextResponse.json(
        { error: 'Missing required fields: userId and weekStartDate' },
        { status: 400 }
      );
    }

    // Collect all weekly data
    const weeklyData = await collectWeeklyData(userId, weekStartDate);
```

**Impact:**
- Complete data breach of user privacy
- Violation of GDPR/HIPAA compliance (if applicable)
- Unauthorized access to sensitive health information
- Potential for data manipulation

**Recommendation:**
1. Implement Firebase Admin SDK on the server-side to verify ID tokens
2. Extract `userId` from the verified token instead of request body
3. Add authorization checks before accessing user data

**Example Fix:**
```typescript
import { adminAuth } from '@/lib/firebase-admin'; // Need to create this

export async function POST(request: NextRequest) {
  try {
    // Get auth token from Authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const userId = decodedToken.uid; // Use verified userId, not from body
    
    const body = await request.json();
    const { weekStartDate } = body;
    // ... rest of code
```

---

## 🟠 HIGH SEVERITY ISSUES

### 2. Missing Firestore Security Rules File
**Severity:** 🟠 High  
**Location:** Repository root (missing `firestore.rules`)

**Issue:**
No `firestore.rules` file exists in the repository. Security rules are only documented in `DEPLOYMENT.md` but not version-controlled. This creates risks:
- Rules may not be properly configured in production
- No audit trail of security rule changes
- Inconsistent rules across environments
- Risk of accidentally deploying with permissive rules

**Recommendation:**
1. Create `firestore.rules` file in repository root
2. Include comprehensive rules for all collections
3. Add rules for `messages` and `coaches` collections (missing from DEPLOYMENT.md)
4. Set up CI/CD to validate rules before deployment

**Required Rules:**
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users collection
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Messages collection (MISSING from current docs)
    match /messages/{messageId} {
      allow read, write: if request.auth != null && resource.data.userId == request.auth.uid;
      allow create: if request.auth != null && request.resource.data.userId == request.auth.uid;
    }
    
    // Coaches collection (MISSING from current docs)
    match /coaches/{coachId} {
      allow read: if request.auth != null;
      allow write: if false; // Only admins should write, implement admin check
    }
    
    // Weekly checkins
    match /weekly_checkins/{checkinId} {
      allow read, write: if request.auth != null && 
        checkinId.matches(request.auth.uid + '_.*');
    }
    
    // Daily checkins
    match /daily_checkins/{checkinId} {
      allow read, write: if request.auth != null && 
        checkinId.matches(request.auth.uid + '_.*');
    }
    
    // Food diary
    match /food_diary/{diaryId} {
      allow read, write: if request.auth != null && 
        diaryId.matches(request.auth.uid + '_.*');
    }
    
    // Water log
    match /water_log/{logId} {
      allow read, write: if request.auth != null && 
        logId.matches(request.auth.uid + '_.*');
    }
    
    // Workout logs
    match /workout_logs/{workoutId} {
      allow read, write: if request.auth != null && 
        resource.data.userId == request.auth.uid;
      allow create: if request.auth != null && 
        request.resource.data.userId == request.auth.uid;
    }
    
    // Cardio log
    match /cardio_log/{cardioId} {
      allow read, write: if request.auth != null && 
        resource.data.userId == request.auth.uid;
      allow create: if request.auth != null && 
        request.resource.data.userId == request.auth.uid;
    }
    
    // Workout routines
    match /workout_routines/{routineId} {
      allow read, write: if request.auth != null && 
        resource.data.userId == request.auth.uid;
    }
    
    // Exercise library
    match /exercise_library/{exerciseId} {
      allow read, write: if request.auth != null && 
        resource.data.userId == request.auth.uid;
    }
    
    // Food library
    match /food_library/{foodId} {
      allow read, write: if request.auth != null && 
        resource.data.userId == request.auth.uid;
    }
    
    // Deny all other access
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

### 3. No Rate Limiting on API Routes
**Severity:** 🟠 High  
**Location:** `src/app/api/generate-coaching-message/route.ts`

**Issue:**
The API route has no rate limiting, which can lead to:
- API abuse and cost escalation (Google Gemini API calls)
- Denial of Service (DoS) attacks
- Resource exhaustion
- Unfair usage by malicious users

**Recommendation:**
1. Implement rate limiting using middleware or a library like `@upstash/ratelimit`
2. Set reasonable limits (e.g., 10 requests per hour per user)
3. Return appropriate HTTP 429 responses
4. Consider implementing per-user quotas

**Example Implementation:**
```typescript
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "1 h"),
});

export async function POST(request: NextRequest) {
  // Get userId from verified token
  const userId = await getVerifiedUserId(request);
  
  const { success } = await ratelimit.limit(userId);
  if (!success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded' },
      { status: 429 }
    );
  }
  // ... rest of code
```

### 4. Missing Input Validation and Sanitization
**Severity:** 🟠 High  
**Location:** `src/app/api/generate-coaching-message/route.ts`

**Issue:**
The API route doesn't validate:
- Date format (`weekStartDate`)
- `userId` format (should be Firebase UID format)
- Request body size limits
- Data types

**Vulnerable Code:**
```typescript:9:17:src/app/api/generate-coaching-message/route.ts
    const body = await request.json();
    const { userId, weekStartDate } = body;

    if (!userId || !weekStartDate) {
      return NextResponse.json(
        { error: 'Missing required fields: userId and weekStartDate' },
        { status: 400 }
      );
    }
```

**Recommendation:**
1. Validate date format (YYYY-MM-DD)
2. Validate Firebase UID format (28 characters, alphanumeric)
3. Add request body size limits (e.g., 1MB max)
4. Use a validation library like `zod` or `joi`

**Example Fix:**
```typescript
import { z } from 'zod';

const requestSchema = z.object({
  weekStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = requestSchema.parse(body);
    // ... rest of code
```

### 5. Error Information Disclosure
**Severity:** 🟠 High  
**Location:** Multiple files

**Issue:**
Error messages may leak sensitive information:
- Stack traces in production
- Internal error details
- File paths and system information

**Examples:**
```typescript:99:107:src/app/api/generate-coaching-message/route.ts
  } catch (error) {
    console.error('Error generating coaching message:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate coaching message',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
```

**Recommendation:**
1. Don't expose internal error details to clients
2. Log detailed errors server-side only
3. Return generic error messages in production
4. Use environment-based error handling

**Example Fix:**
```typescript
} catch (error) {
  console.error('Error generating coaching message:', error);
  const isDev = process.env.NODE_ENV === 'development';
  return NextResponse.json(
    {
      error: 'Failed to generate coaching message',
      ...(isDev && { details: error instanceof Error ? error.message : 'Unknown error' }),
    },
    { status: 500 }
  );
}
```

---

## 🟡 MEDIUM SEVERITY ISSUES

### 6. Missing Security Headers
**Severity:** 🟡 Medium  
**Location:** `next.config.ts`

**Issue:**
No security headers configured, leaving the application vulnerable to:
- XSS attacks
- Clickjacking
- MIME type sniffing
- Protocol downgrade attacks

**Recommendation:**
Add security headers in `next.config.ts`:

```typescript
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
            value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://*.firebaseapp.com https://*.googleapis.com;"
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()'
          }
        ],
      },
    ];
  },
};
```

### 7. Client-Side Only Authentication
**Severity:** 🟡 Medium  
**Location:** `src/components/AuthGuard.tsx`

**Issue:**
`AuthGuard` only protects client-side routes. Server-side rendering (SSR) pages may expose protected content before client-side JavaScript loads.

**Recommendation:**
1. Implement server-side authentication checks in page components
2. Use Next.js middleware for route protection
3. Consider using `getServerSession` or similar for SSR pages

### 8. No CSRF Protection
**Severity:** 🟡 Medium  
**Location:** API routes and forms

**Issue:**
No CSRF tokens for state-changing operations. While Firebase handles some CSRF protection, additional measures are recommended for custom API routes.

**Recommendation:**
1. Implement CSRF tokens for POST/PUT/DELETE requests
2. Use SameSite cookies
3. Verify Origin/Referer headers in API routes

### 9. Firebase API Keys Exposed Client-Side
**Severity:** 🟡 Medium  
**Location:** `src/lib/firebase.ts`

**Issue:**
Firebase API keys are exposed in client-side code via `NEXT_PUBLIC_` prefix. While Firebase API keys are designed to be public, they should still be restricted.

**Current Code:**
```typescript:6:11:src/lib/firebase.ts
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};
```

**Recommendation:**
1. Configure Firebase API key restrictions in Firebase Console:
   - Restrict to specific HTTP referrers (your domains)
   - Restrict to specific IP addresses if possible
2. Monitor API key usage in Firebase Console
3. Rotate keys if compromised

### 10. Missing Request Size Limits
**Severity:** 🟡 Medium  
**Location:** `src/app/api/generate-coaching-message/route.ts`

**Issue:**
No explicit request body size limits, allowing potential DoS via large payloads.

**Recommendation:**
Add body size limits in Next.js config or middleware:

```typescript
// In next.config.ts or API route
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
};
```

---

## 🟢 LOW SEVERITY ISSUES

### 11. Missing Environment Variable Validation
**Severity:** 🟢 Low  
**Location:** `src/lib/firebase.ts`, `src/lib/genkit.ts`

**Issue:**
Environment variables are not validated at startup, which could lead to runtime errors.

**Recommendation:**
Add startup validation:

```typescript
const requiredEnvVars = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'GOOGLE_GENAI_API_KEY',
];

if (typeof window === 'undefined') {
  requiredEnvVars.forEach(varName => {
    if (!process.env[varName]) {
      throw new Error(`Missing required environment variable: ${varName}`);
    }
  });
}
```

### 12. No Request Logging/Monitoring
**Severity:** 🟢 Low  
**Location:** API routes

**Issue:**
No structured logging or monitoring for security events (failed auth attempts, rate limit hits, etc.).

**Recommendation:**
1. Implement structured logging (e.g., Winston, Pino)
2. Log security-relevant events
3. Set up alerts for suspicious activity
4. Consider integrating with monitoring services (Sentry, LogRocket)

### 13. Missing Content Security Policy (CSP) Nonces
**Severity:** 🟢 Low  
**Location:** `src/app/layout.tsx`

**Issue:**
CSP headers (if added) should use nonces for inline scripts/styles to prevent XSS.

**Recommendation:**
Implement CSP with nonces for better security:

```typescript
// In next.config.ts
const generateCSP = () => {
  const nonce = crypto.randomBytes(16).toString('base64');
  return {
    'Content-Security-Policy': `script-src 'self' 'nonce-${nonce}'; ...`
  };
};
```

---

## Additional Security Recommendations

### 1. Implement Firebase Admin SDK
Create a server-side Firebase Admin SDK configuration for API route authentication:

```typescript
// src/lib/firebase-admin.ts
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

export const adminAuth = getAuth();
```

### 2. Add API Authentication Middleware
Create reusable middleware for API route authentication:

```typescript
// src/lib/api-auth.ts
import { NextRequest } from 'next/server';
import { adminAuth } from './firebase-admin';

export async function verifyAuth(request: NextRequest): Promise<string> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Unauthorized');
  }
  
  const idToken = authHeader.split('Bearer ')[1];
  const decodedToken = await adminAuth.verifyIdToken(idToken);
  return decodedToken.uid;
}
```

### 3. Dependency Security
Regularly audit dependencies for vulnerabilities:

```bash
npm audit
npm audit fix
```

Consider using `npm audit` in CI/CD pipeline.

### 4. Implement Request ID Tracking
Add request IDs to all API responses for better traceability:

```typescript
const requestId = crypto.randomUUID();
// Include in response headers and logs
```

### 5. Add Health Check Endpoint
Create a health check endpoint for monitoring:

```typescript
// src/app/api/health/route.ts
export async function GET() {
  return NextResponse.json({ status: 'ok', timestamp: new Date().toISOString() });
}
```

---

## Priority Action Items

### Immediate (Critical)
1. ✅ Fix API route authentication bypass (#1)
2. ✅ Create and deploy Firestore security rules (#2)

### Short-term (High Priority)
3. ✅ Implement rate limiting (#3)
4. ✅ Add input validation (#4)
5. ✅ Fix error information disclosure (#5)

### Medium-term (Medium Priority)
6. ✅ Add security headers (#6)
7. ✅ Implement server-side auth checks (#7)
8. ✅ Add CSRF protection (#8)

### Long-term (Low Priority)
9. ✅ Implement monitoring and logging (#12)
10. ✅ Add dependency scanning to CI/CD

---

## Compliance Considerations

If this application handles health data (HIPAA) or EU user data (GDPR):

1. **HIPAA Compliance:**
   - Ensure proper access controls (✅ after fixing #1)
   - Implement audit logging (#12)
   - Encrypt data at rest and in transit
   - Business Associate Agreement (BAA) with Firebase/Google

2. **GDPR Compliance:**
   - Implement data access/deletion endpoints
   - Add privacy policy and consent mechanisms
   - Implement data export functionality
   - Ensure proper data retention policies

---

## Testing Recommendations

1. **Penetration Testing:**
   - Test IDOR vulnerabilities (#1)
   - Test rate limiting (#3)
   - Test input validation (#4)

2. **Security Scanning:**
   - Run OWASP ZAP or similar
   - Use Snyk or Dependabot for dependency scanning
   - Regular security audits

3. **Code Review:**
   - Implement mandatory security reviews for PRs
   - Use automated security linting tools

---

## Conclusion

The application has a solid foundation with Firebase Authentication, but critical security gaps exist in API route authentication. Immediate action is required to prevent unauthorized data access. After addressing the critical and high-severity issues, the application will be significantly more secure.

**Estimated Fix Time:**
- Critical issues: 4-8 hours
- High severity: 8-16 hours
- Medium severity: 16-24 hours
- Low severity: 8-16 hours

**Total: 36-64 hours of development time**

---

*This report should be reviewed and updated regularly as the application evolves.*


