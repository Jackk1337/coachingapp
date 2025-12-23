# PWA Setup Guide

This app now supports Progressive Web App (PWA) functionality with "Add to Home Screen" prompts for mobile devices.

## Features

- ✅ Automatic detection of iOS and Android devices
- ✅ Native install prompt for Android/Chrome
- ✅ Custom instructions for iOS Safari
- ✅ Smart dismissal (won't show again for 7 days after dismissing)
- ✅ Detects if app is already installed

## Required: Add App Icons

You need to add two icon files to the `public` folder:

1. **`public/icon-192.png`** - 192x192 pixels
2. **`public/icon-512.png`** - 512x512 pixels

### How to Create Icons

1. **Design your icon** (square, with some padding for safe area)
2. **Export as PNG** at both sizes
3. **Place in `public` folder**

### Quick Option: Generate Icons Online

You can use online tools like:
- https://www.pwabuilder.com/imageGenerator
- https://realfavicongenerator.net/
- https://www.favicon-generator.org/

Or create simple placeholder icons using any image editor.

### Icon Requirements

- **Format**: PNG
- **Sizes**: 192x192 and 512x512 pixels
- **Design**: Square icons work best (they'll be automatically masked on some platforms)
- **Background**: Can be transparent or solid color

## Testing

### Android/Chrome
1. Open the app in Chrome on Android
2. After a few seconds, you should see an install prompt
3. Tap "Install App" to add to home screen

### iOS Safari
1. Open the app in Safari on iPhone/iPad
2. After 3 seconds, you'll see instructions
3. Follow the steps to manually add to home screen (iOS doesn't support automatic install)

## Manifest Configuration

The `public/manifest.json` file controls PWA settings. You can customize:
- App name and description
- Theme colors
- Display mode (standalone, fullscreen, etc.)
- Orientation preferences

## Notes

- The prompt will automatically dismiss if the user has already installed the app
- Users can dismiss the prompt, and it won't show again for 7 days
- The component only shows on mobile devices (iOS/Android)

