# Vercel Deployment Guide

This guide will help you deploy your coaching app to Vercel.

## Prerequisites

1. A Vercel account (sign up at https://vercel.com)
2. Your Firebase project configured
3. Your code pushed to a Git repository (GitHub, GitLab, or Bitbucket)

## Step 1: Push to Git Repository

If you haven't already, initialize a git repository and push your code:

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin <your-repo-url>
git push -u origin main
```

## Step 2: Deploy to Vercel

### Option A: Deploy via Vercel Dashboard

1. Go to [https://vercel.com/new](https://vercel.com/new)
2. Import your Git repository
3. Vercel will automatically detect Next.js
4. Configure your project:
   - **Framework Preset**: Next.js (auto-detected)
   - **Root Directory**: `./` (default)
   - **Build Command**: `npm run build` (default)
   - **Output Directory**: `.next` (default)
   - **Install Command**: `npm install` (default)

### Option B: Deploy via Vercel CLI

1. Install Vercel CLI:
   ```bash
   npm i -g vercel
   ```

2. Login to Vercel:
   ```bash
   vercel login
   ```

3. Deploy:
   ```bash
   vercel
   ```

4. Follow the prompts to link your project

## Step 3: Configure Environment Variables

In your Vercel project dashboard, go to **Settings** → **Environment Variables** and add the following:

### Required Firebase Environment Variables:

```
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

**Where to find these values:**
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to Project Settings (gear icon)
4. Scroll down to "Your apps" section
5. Click on your web app or create a new one
6. Copy the values from the `firebaseConfig` object

## Step 4: Update Firebase Authentication Settings

1. Go to Firebase Console → Authentication → Settings
2. Add your Vercel domain to **Authorized domains**:
   - `your-app.vercel.app` (production)
   - `your-app-git-main.vercel.app` (preview)
   - `your-app-*.vercel.app` (preview branches)

## Step 5: Update Firestore Security Rules

Make sure your Firestore security rules are properly configured. Example rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users collection
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Workout routines
    match /workout_routines/{routineId} {
      allow read, write: if request.auth != null && resource.data.userId == request.auth.uid;
    }
    
    // Exercise library
    match /exercise_library/{exerciseId} {
      allow read, write: if request.auth != null && resource.data.userId == request.auth.uid;
    }
    
    // Workout logs
    match /workout_logs/{workoutId} {
      allow read, write: if request.auth != null && resource.data.userId == request.auth.uid;
    }
    
    // Daily checkins
    match /daily_checkins/{checkinId} {
      allow read, write: if request.auth != null && resource.data.userId == request.auth.uid;
    }
    
    // Cardio log
    match /cardio_log/{cardioId} {
      allow read, write: if request.auth != null && resource.data.userId == request.auth.uid;
    }
    
    // Food diary
    match /food_diary/{diaryId} {
      allow read, write: if request.auth != null && resource.data.userId == request.auth.uid;
    }
    
    // Food library
    match /food_library/{foodId} {
      allow read, write: if request.auth != null && resource.data.userId == request.auth.uid;
    }
  }
}
```

## Step 6: Redeploy

After adding environment variables, Vercel will automatically redeploy. If not:

1. Go to your project dashboard
2. Click on the **Deployments** tab
3. Click the three dots on the latest deployment
4. Select **Redeploy**

## Step 7: Test Your Deployment

1. Visit your deployed app URL (provided by Vercel)
2. Test the login flow
3. Verify all features work correctly
4. Check browser console for any errors

## Troubleshooting

### Build Fails
- Check the build logs in Vercel dashboard
- Ensure all environment variables are set
- Verify Node.js version compatibility (Vercel uses Node 20.x by default)

### Authentication Not Working
- Verify Firebase environment variables are correct
- Check that your Vercel domain is added to Firebase authorized domains
- Ensure `NEXT_PUBLIC_` prefix is used for client-side variables

### Camera/Barcode Scanner Not Working
- Camera access requires HTTPS (Vercel provides this automatically)
- Some browsers may block camera access - test in Chrome/Firefox
- Check browser console for permission errors

## Custom Domain (Optional)

1. Go to your Vercel project → Settings → Domains
2. Add your custom domain
3. Follow DNS configuration instructions
4. Update Firebase authorized domains with your custom domain

## Continuous Deployment

Vercel automatically deploys:
- **Production**: Every push to `main` branch
- **Preview**: Every push to other branches (creates preview deployments)

## Need Help?

- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Firebase Setup](https://firebase.google.com/docs/web/setup)



