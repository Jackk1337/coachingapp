# Sales Website Design Prompt for RallyFit

## Project Overview
Create a modern, conversion-focused 5-page sales website for a comprehensive fitness coaching SaaS application. The website should showcase the app's features, benefits, and drive user sign-ups.

## Brand Identity

### App Name
**RallyFit**

### Tagline
"Track your fitness journey"

### Brand Description
A comprehensive SaaS coaching application for tracking workouts, food, cardio, and daily logs with AI-powered personalized coaching.

## Color Scheme

### Light Mode Palette
- **Background**: Pure white `oklch(1 0 0)` - Clean, minimal
- **Foreground/Text**: Dark gray `oklch(0.145 0 0)` - High contrast for readability
- **Primary**: Dark gray `oklch(0.205 0 0)` - For CTAs and primary actions
- **Primary Foreground**: Off-white `oklch(0.985 0 0)` - Text on primary buttons
- **Secondary**: Light gray `oklch(0.97 0 0)` - Subtle backgrounds
- **Muted**: Light gray `oklch(0.97 0 0)` - Background variations
- **Muted Foreground**: Medium gray `oklch(0.556 0 0)` - Secondary text
- **Border**: Light gray `oklch(0.922 0 0)` - Subtle borders
- **Destructive/Error**: Red `oklch(0.577 0.245 27.325)` - Error states
- **Chart Colors** (for data visualization):
  - Chart 1: Orange `oklch(0.646 0.222 41.116)`
  - Chart 2: Teal `oklch(0.6 0.118 184.704)`
  - Chart 3: Blue `oklch(0.398 0.07 227.392)`
  - Chart 4: Yellow `oklch(0.828 0.189 84.429)`
  - Chart 5: Light Orange `oklch(0.769 0.188 70.08)`

### Dark Mode Palette (Primary Theme)
- **Background**: Deep dark blue-gray `oklch(0.12 0.02 250)` - Modern, professional
- **Foreground/Text**: Off-white `oklch(0.98 0 0)` - High contrast
- **Card Background**: Dark blue-gray `oklch(0.18 0.02 250)` - Elevated surfaces
- **Primary**: Vibrant blue `oklch(0.65 0.22 250)` - **Main brand color for CTAs**
- **Primary Foreground**: Off-white `oklch(0.98 0 0)` - Text on primary buttons
- **Secondary**: Darker blue-gray `oklch(0.25 0.02 250)` - Secondary elements
- **Muted**: Subtle blue-gray `oklch(0.20 0.02 250)` - Background variations
- **Muted Foreground**: Medium gray `oklch(0.65 0 0)` - Secondary text
- **Accent**: Blue accent `oklch(0.30 0.05 250)` - Highlights
- **Border**: Subtle blue-gray `oklch(0.25 0.02 250 / 0.5)` - Semi-transparent borders
- **Ring/Focus**: Vibrant blue `oklch(0.65 0.22 250)` - Focus states
- **Destructive/Error**: Red `oklch(0.65 0.22 25)` - Error states
- **Chart Colors** (blue variations):
  - Chart 1: Vibrant blue `oklch(0.65 0.22 250)`
  - Chart 2: Blue `oklch(0.55 0.18 240)`
  - Chart 3: Light blue `oklch(0.70 0.20 260)`
  - Chart 4: Medium blue `oklch(0.60 0.15 230)`
  - Chart 5: Purple-blue `oklch(0.75 0.25 270)`

### Design Notes
- **Primary CTA Color**: Use vibrant blue `oklch(0.65 0.22 250)` for all call-to-action buttons
- **Border Radius**: `0.625rem` (10px) - Modern, rounded corners
- **Theme**: Dark mode should be the primary/preferred theme for the sales site
- **Transitions**: Smooth transitions (150ms) for all interactive elements

## Typography

### Fonts
- **Primary Font**: Geist Sans (modern, clean sans-serif)
- **Monospace Font**: Geist Mono (for code/data display)
- **Font Features**: Enable ligatures and contextual alternates

### Typography Scale
- Use clear hierarchy with bold headings
- Body text should be readable with good contrast
- Emphasize key benefits and features with larger, bolder text

## Design System

### UI Framework
- **Base**: ShadCN UI components (New York style)
- **CSS Framework**: Tailwind CSS v4
- **Component Style**: Modern, clean, minimal with subtle shadows and borders

### Component Characteristics
- Cards with subtle elevation
- Rounded corners (`0.625rem` border radius)
- Clean, minimal button styles
- Smooth hover transitions
- Focus states with blue ring

## Website Structure: 5 Pages

### Page 1: Landing/Homepage
**Purpose**: Hero section with main value proposition and primary CTA

**Key Elements**:
- Hero section with headline, subheadline, and primary CTA button
- Key features showcase (3-4 main features with icons)
- Social proof/testimonials section
- Secondary CTA section
- Footer with navigation links

**Content Focus**:
- "Track your fitness journey" - main value prop
- Highlight AI-powered coaching
- Emphasize comprehensive tracking (workouts, food, cardio, progress)

### Page 2: Features
**Purpose**: Detailed feature breakdown

**Key Elements**:
- Feature cards for each major capability:
  1. **Workout Logging** - Track exercises, sets, reps, weight, RPE
  2. **Food Diary** - Calorie and macro tracking with barcode scanning
  3. **Cardio Log** - Track cardio sessions with heart rate and calories
  4. **Daily Check-ins** - Monitor weight, steps, sleep, training status
  5. **Progress Tracking** - Visualize progress with charts and weekly summaries
  6. **AI Coach** - Personalized weekly coaching messages powered by AI
  7. **Water Logging** - Track daily water intake
  8. **Supplements Tracking** - Log supplement intake
- Icons from Lucide React icon library
- Visual mockups or screenshots of features
- CTA buttons throughout

### Page 3: How It Works
**Purpose**: Explain the user journey and app workflow

**Key Elements**:
- Step-by-step process (3-5 steps)
- Visual flow diagram or illustrations
- Onboarding process explanation
- Weekly coaching message flow
- Integration with Firebase/Google Sign-In

**Content Focus**:
- Simple, clear steps
- Show ease of use
- Highlight AI coaching integration

### Page 4: Pricing/Plans
**Purpose**: Display pricing tiers and plans

**Key Elements**:
- Pricing cards (if multiple tiers) or single plan showcase
- Feature comparison (if multiple tiers)
- Clear CTA buttons for each plan
- FAQ section addressing common pricing questions
- Money-back guarantee or trial information (if applicable)

**Content Focus**:
- Value proposition
- What's included
- Clear pricing structure

### Page 5: About/Contact
**Purpose**: Build trust and provide contact information

**Key Elements**:
- About section explaining the mission
- Contact form or email
- Social media links (if applicable)
- Privacy policy and terms links
- Final CTA section

**Content Focus**:
- Trust building
- Transparency
- Easy contact method

## Key Features to Highlight

1. **🔐 Authentication**: Google Sign-In with Firebase
2. **💪 Workout Logging**: Track workouts with exercises, sets, reps, weight, and RPE
3. **🍎 Food Diary**: Log meals with calorie and macro tracking
4. **🏃 Cardio Log**: Track cardio sessions with heart rate and calories
5. **✅ Daily Check-ins**: Monitor weight, steps, sleep, and training status
6. **📊 Progress Tracking**: Visualize progress with charts and weekly summaries
7. **🤖 AI Coach**: Get personalized weekly coaching messages powered by Firebase Genkit and Google Gemini
8. **💧 Water Logging**: Track daily water intake goals
9. **💊 Supplements**: Track supplement intake
10. **📱 Mobile Responsive**: Optimized for mobile devices and PWA support

## Technical Stack (for reference)

- **Framework**: Next.js 16
- **UI**: ShadCN UI + Tailwind CSS
- **Backend**: Firebase (Firestore + Authentication)
- **AI**: Firebase Genkit with Google Gemini
- **Charts**: Recharts
- **Icons**: Lucide React

## Design Guidelines

### Visual Style
- **Modern & Clean**: Minimal design with plenty of white space
- **Professional**: Fitness/health industry appropriate
- **Trustworthy**: Clean, professional aesthetic
- **Mobile-First**: Responsive design that works beautifully on all devices
- **Dark Mode Preferred**: Use dark mode as the primary theme

### Call-to-Action Buttons
- Use vibrant blue `oklch(0.65 0.22 250)` for primary CTAs
- Clear, action-oriented text ("Get Started", "Start Free Trial", "Sign Up Now")
- Prominent placement above the fold
- Multiple CTAs throughout each page

### Imagery & Graphics
- Use fitness/health-related imagery
- Show app screenshots or mockups
- Use icons from Lucide React library (Dumbbell, Utensils, Activity, CalendarCheck, TrendingUp, Droplet, Pill, etc.)
- Charts and data visualizations using the chart color palette

### Conversion Optimization
- Clear value proposition in hero section
- Social proof (testimonials, user counts, etc.)
- Scarcity or urgency (if applicable)
- Easy sign-up process
- Trust signals (security badges, guarantees, etc.)

## Content Tone

- **Professional yet approachable**
- **Motivational and encouraging**
- **Clear and concise**
- **Benefit-focused** (what users get, not just features)
- **Action-oriented**

## Additional Notes

- Ensure all pages are mobile-responsive
- Include smooth scroll animations
- Use consistent navigation across all pages
- Include footer with links to all pages
- Consider adding a blog/resources section (optional)
- Include privacy policy and terms of service links
- Add analytics tracking setup instructions

---

## Implementation Checklist

- [ ] Design hero section with compelling headline
- [ ] Create feature showcase cards
- [ ] Build pricing page layout
- [ ] Design contact/about page
- [ ] Implement responsive navigation
- [ ] Add smooth scroll animations
- [ ] Create mobile-optimized layouts
- [ ] Add social proof sections
- [ ] Implement CTA buttons throughout
- [ ] Add footer with all links
- [ ] Test on multiple devices
- [ ] Optimize for SEO
- [ ] Set up analytics tracking


