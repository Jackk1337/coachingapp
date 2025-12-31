# Vulnerabilities Exploitable by Unauthenticated Users

This document analyzes which security issues can be exploited **without requiring Google Sign-In authentication**.

---

## 🔴 CRITICAL: Exploitable Without Authentication

### 1. API Route Has No Authentication Check
**Severity:** 🔴 Critical  
**Exploitable:** ✅ YES - Completely unauthenticated

**Current Code:**
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

**Exploitation:**
- **Any unauthenticated user** can call this API endpoint
- They only need to guess or discover a valid `userId` (Firebase UIDs are predictable)
- They can trigger expensive AI API calls (costing you money)
- They can potentially access user data if Firestore rules are misconfigured
- They can cause Denial of Service by flooding the endpoint

**Attack Scenario:**
```bash
# Unauthenticated attacker can do this:
curl -X POST https://your-app.vercel.app/api/generate-coaching-message \
  -H "Content-Type: application/json" \
  -d '{"userId": "any-user-id-here", "weekStartDate": "2024-01-01"}'
```

**Impact:**
- 💰 **Cost escalation** - Unauthenticated users can drain your Google Gemini API quota
- 🔓 **Potential data access** - If Firestore rules allow, they can read user data
- 🚫 **DoS attacks** - Can overwhelm your API with requests
- 📊 **Data enumeration** - Can test different userIds to discover valid accounts

---

### 2. Missing Firestore Security Rules (If Not Deployed)
**Severity:** 🔴 Critical  
**Exploitable:** ✅ YES - Completely unauthenticated

**Issue:**
If Firestore security rules are not properly deployed or are set to allow public access, **any unauthenticated user** can:
- Read all user data directly from Firestore
- Write/modify data in Firestore
- Access sensitive health information
- Enumerate all users

**Default Firestore Rules (DANGEROUS):**
```javascript
// If these are the active rules, unauthenticated users have full access:
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true; // ⚠️ DANGER: Allows everyone!
    }
  }
}
```

**Exploitation:**
Unauthenticated users can use Firebase SDK directly or REST API:
```javascript
// From browser console or any client:
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const db = getFirestore();
const usersSnapshot = await getDocs(collection(db, 'users'));
// Can read ALL user data without authentication!
```

**Impact:**
- 🔓 **Complete data breach** - All user data accessible
- ✏️ **Data manipulation** - Can modify or delete data
- 📋 **User enumeration** - Can list all users
- ⚖️ **GDPR/HIPAA violations** - Major compliance issues

**Check Your Rules:**
1. Go to Firebase Console → Firestore Database → Rules
2. Verify rules require `request.auth != null`
3. Ensure `firestore.rules` file is deployed

---

## 🟠 HIGH: Exploitable Without Authentication

### 3. No Rate Limiting on API Routes
**Severity:** 🟠 High  
**Exploitable:** ✅ YES - Completely unauthenticated

**Issue:**
Since the API route has no authentication check, unauthenticated users can:
- Make unlimited requests
- Cause DoS attacks
- Drain your API quota/costs
- Overwhelm your server resources

**Attack Example:**
```bash
# Unauthenticated attacker can spam requests:
for i in {1..1000}; do
  curl -X POST https://your-app.vercel.app/api/generate-coaching-message \
    -H "Content-Type: application/json" \
    -d '{"userId": "victim-user-id", "weekStartDate": "2024-01-01"}' &
done
```

**Impact:**
- 💰 **Financial impact** - Each request costs money (Google Gemini API)
- 🚫 **Service disruption** - Can make service unavailable
- 📈 **Resource exhaustion** - Can crash your server

---

### 4. Error Information Disclosure
**Severity:** 🟠 High  
**Exploitable:** ✅ YES - Partially unauthenticated

**Current Code:**
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

**Exploitation:**
Unauthenticated users can trigger errors to:
- Discover internal system details
- Learn about database structure
- Find file paths and system information
- Identify vulnerable dependencies

**Attack Example:**
```bash
# Send malformed requests to trigger errors:
curl -X POST https://your-app.vercel.app/api/generate-coaching-message \
  -H "Content-Type: application/json" \
  -d '{"invalid": "data"}' 
# May reveal error details about Firestore, API keys, etc.
```

**Impact:**
- 🔍 **Information leakage** - Helps attackers understand your system
- 🎯 **Attack surface expansion** - Reveals potential attack vectors

---

### 5. Missing Input Validation
**Severity:** 🟠 High  
**Exploitable:** ✅ YES - Completely unauthenticated

**Issue:**
The API route doesn't validate input format, allowing unauthenticated users to:
- Send malformed data causing errors
- Potentially exploit parsing vulnerabilities
- Cause application crashes

**Attack Example:**
```bash
# Send invalid date formats, SQL injection attempts, etc.:
curl -X POST https://your-app.vercel.app/api/generate-coaching-message \
  -H "Content-Type: application/json" \
  -d '{"userId": "../../etc/passwd", "weekStartDate": "<script>alert(1)</script>"}'
```

**Impact:**
- 🐛 **Application instability** - Can crash the service
- 🔓 **Potential injection** - If not properly sanitized

---

## 🟡 MEDIUM: Exploitable Without Authentication

### 6. Missing Security Headers
**Severity:** 🟡 Medium  
**Exploitable:** ✅ YES - Completely unauthenticated

**Issue:**
Missing security headers allow unauthenticated attackers to:
- Perform XSS attacks (if other vulnerabilities exist)
- Perform clickjacking attacks
- Exploit MIME type confusion
- Perform protocol downgrade attacks

**Attack Scenarios:**
- **XSS:** If user input is reflected without sanitization, attackers can inject scripts
- **Clickjacking:** Can embed your app in iframe and trick users
- **MIME Sniffing:** Can serve malicious files that browsers execute

**Impact:**
- 🎣 **Phishing attacks** - Clickjacking can trick users
- 🔓 **Session hijacking** - XSS can steal authentication tokens
- 📱 **User deception** - Can manipulate user interactions

---

### 7. Client-Side Only Authentication (SSR Content Exposure)
**Severity:** 🟡 Medium  
**Exploitable:** ✅ YES - Partially unauthenticated

**Issue:**
`AuthGuard` only runs client-side. During Server-Side Rendering (SSR), protected content may be:
- Rendered in initial HTML before client-side auth check
- Accessible to unauthenticated users via direct HTML requests
- Crawled by search engines
- Visible in page source

**Attack Example:**
```bash
# Unauthenticated user can view SSR content:
curl https://your-app.vercel.app/messages
# May see protected content in HTML before client-side redirect
```

**Impact:**
- 👁️ **Content exposure** - Protected content visible in HTML
- 🔍 **SEO leakage** - Search engines may index protected pages
- 📄 **Data scraping** - Bots can extract data from HTML

---

### 8. Firebase API Keys Exposed Client-Side
**Severity:** 🟡 Medium  
**Exploitable:** ✅ YES - Completely unauthenticated

**Issue:**
Firebase API keys are visible in client-side JavaScript. While designed to be public, if not properly restricted in Firebase Console, unauthenticated users can:
- Use your API keys from other domains
- Abuse your Firebase quotas
- Potentially access Firebase services if restrictions aren't set

**Current Exposure:**
```typescript:6:11:src/lib/firebase.ts
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY, // ⚠️ Visible in browser
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  // ... all visible in client bundle
};
```

**Attack Scenario:**
1. Attacker views page source or browser DevTools
2. Extracts Firebase API keys
3. Uses keys from their own domain/application
4. Abuses your Firebase quotas/services

**Mitigation:**
- ✅ Restrict API keys in Firebase Console to specific HTTP referrers
- ✅ Monitor API key usage in Firebase Console
- ✅ Set up alerts for unusual usage patterns

**Impact:**
- 💰 **Quota abuse** - Can drain your Firebase quotas
- 🔓 **Service abuse** - Can use your Firebase project resources

---

## 🟢 LOW: Exploitable Without Authentication

### 9. Missing Request Size Limits
**Severity:** 🟢 Low  
**Exploitable:** ✅ YES - Completely unauthenticated

**Issue:**
No explicit request body size limits allow unauthenticated users to:
- Send extremely large payloads
- Cause memory exhaustion
- Perform DoS attacks

**Impact:**
- 🚫 **DoS attacks** - Can crash server with large requests
- 💾 **Resource exhaustion** - Can consume server memory

---

## Summary: Unauthenticated Exploitation Risk

### Critical Issues (Fix Immediately)
1. ✅ **API Route Authentication** - Completely exploitable, allows data access and cost escalation
2. ✅ **Firestore Security Rules** - If misconfigured, allows complete data breach

### High Priority Issues
3. ✅ **Rate Limiting** - Allows DoS and cost escalation
4. ✅ **Error Disclosure** - Helps attackers understand system
5. ✅ **Input Validation** - Can cause crashes and instability

### Medium Priority Issues
6. ✅ **Security Headers** - Protects against XSS, clickjacking
7. ✅ **SSR Content Exposure** - May expose protected content
8. ✅ **Firebase API Keys** - Can be abused if not restricted

### Low Priority Issues
9. ✅ **Request Size Limits** - DoS vector

---

## Immediate Action Required

### Priority 1: Fix API Authentication (CRITICAL)
The API route **MUST** verify authentication before processing requests. Currently, any unauthenticated user can:
- Call the API endpoint
- Trigger expensive AI operations
- Potentially access user data

**Fix:** Implement Firebase Admin SDK authentication check (see `SECURITY_FIXES_GUIDE.md`)

### Priority 2: Verify Firestore Rules (CRITICAL)
Ensure Firestore security rules are deployed and require authentication:
- Check Firebase Console → Firestore → Rules
- Verify all collections require `request.auth != null`
- Deploy `firestore.rules` file if not already deployed

### Priority 3: Add Rate Limiting (HIGH)
Implement rate limiting to prevent abuse:
- Use IP-based rate limiting for unauthenticated requests
- Use user-based rate limiting for authenticated requests
- Set reasonable limits (e.g., 10 requests/hour)

---

## Testing Unauthenticated Access

You can test these vulnerabilities yourself:

```bash
# Test 1: Can unauthenticated user call API?
curl -X POST http://localhost:3000/api/generate-coaching-message \
  -H "Content-Type: application/json" \
  -d '{"userId": "test-user", "weekStartDate": "2024-01-01"}'

# Test 2: Check if Firestore is accessible
# Open browser console on your site and try:
# (This will fail if rules are correct, succeed if misconfigured)

# Test 3: Check exposed API keys
# View page source and search for "NEXT_PUBLIC_FIREBASE_API_KEY"
# Or check browser DevTools → Network → Look for Firebase requests
```

---

## Conclusion

**5 out of 13 security issues can be exploited by completely unauthenticated users**, including:
- 1 Critical issue (API authentication)
- 1 Critical issue (Firestore rules if misconfigured)
- 3 High severity issues (rate limiting, error disclosure, input validation)
- 3 Medium severity issues (security headers, SSR exposure, API keys)
- 1 Low severity issue (request limits)

**The most critical risk is the API route that has no authentication check whatsoever.** This should be fixed immediately as it's exploitable by anyone on the internet.





