# Coaching App

A comprehensive SaaS coaching application built with Next.js, Firebase, and ShadCN UI for tracking workouts, food, cardio, and daily logs.

## Features

- 🔐 **Authentication**: Google Sign-In with Firebase
- 💪 **Workout Logging**: Track workouts with exercises, sets, reps, weight, and RPE
- 🍎 **Food Diary**: Log meals with calorie and macro tracking
- 🏃 **Cardio Log**: Track cardio sessions with heart rate and calories
- ✅ **Daily Check-ins**: Monitor weight, steps, sleep, and training status
- 📊 **Progress Tracking**: Visualize progress with charts and weekly summaries
- 🤖 **AI Coach**: Get personalized weekly coaching messages powered by Firebase Genkit and Google Gemini
- 📱 **Mobile Responsive**: Optimized for mobile devices

## Tech Stack

- **Framework**: Next.js 16
- **UI**: ShadCN UI + Tailwind CSS
- **Backend**: Firebase (Firestore + Authentication)
- **AI**: Firebase Genkit with Google Gemini
- **Charts**: Recharts
- **Barcode Scanning**: html5-qrcode
- **Date Handling**: date-fns

## Getting Started

### Prerequisites

- Node.js 20.x or higher
- npm or yarn
- Firebase project

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd coachingapp
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

4. Fill in your Firebase configuration in `.env.local`:
```
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
GOOGLE_GENAI_API_KEY=your_gemini_api_key
```

**To get your Gemini API Key:**
1. Visit [Google AI Studio](https://ai.google.dev/)
2. Sign in and click "Get API Key"
3. Create a new API key and copy it

5. Run the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed Vercel deployment instructions.

### Quick Deploy to Vercel

1. Push your code to GitHub/GitLab/Bitbucket
2. Import your repository in [Vercel](https://vercel.com/new)
3. Add environment variables in Vercel dashboard
4. Deploy!

## Firebase Setup

1. Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)
2. Enable Authentication → Google Sign-In
3. Create a Firestore database
4. Set up Firestore security rules (see DEPLOYMENT.md)
5. Copy your Firebase config to `.env.local`

## Project Structure

```
src/
├── app/              # Next.js app router pages
├── components/        # React components
│   ├── ui/          # ShadCN UI components
│   └── AuthGuard.tsx
├── context/          # React contexts
│   └── AuthContext.tsx
└── lib/             # Utilities
    ├── firebase.ts  # Firebase configuration
    └── utils.ts     # Helper functions
```

## License

Private - All rights reserved
