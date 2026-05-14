# Home Bill & Rent Manager

A React Native mobile app to track monthly electricity bills and rent payments, with AI-powered meter scanning, spending insights, and a bill splitter.

## Features

- Dashboard showing current month's electricity and rent status, pending payment alerts, and year-to-date spend summary
- Electricity bill tracking with previous/current meter readings, auto-calculated units consumed and total amount
- AI meter scanning — photograph your meter and OpenAI GPT-4o Vision auto-fills the current reading
- Meter photo attachment stored per bill record with full-screen image viewer
- Rent payment tracking with month/year picker, payment status, and paid-date stamping
- Overdue detection with visual red stripe and badge on list cards
- Swipe-to-pay and swipe-to-delete gestures on bill and rent cards
- Bill splitter calculator: splits a shared electricity bill across up to three floors/parties by units consumed, generates an AI-formatted WhatsApp message, and stores split history
- Analytics screen with animated bar charts (bill amount, units consumed, rent) per year and stat cards (avg, highest, lowest, total paid, unpaid count)
- CSV data export for any year — copies to clipboard for pasting into Sheets or Excel
- Onboarding flow and customisable apartment name in settings
- Fully offline — local SQLite storage; internet only needed for optional AI features

## Tech Stack

- React Native 0.81 / Expo SDK 54
- TypeScript
- expo-router (file-based navigation)
- expo-sqlite (local database)
- react-native-gifted-charts (animated bar charts)
- react-native-gesture-handler (swipeable cards)
- expo-image-picker (camera and gallery)
- expo-haptics (tactile feedback)
- expo-clipboard (CSV copy)
- OpenAI GPT-4o (meter OCR, dashboard insights, WhatsApp message generation)

## Getting Started

### Prerequisites

- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)
- iOS Simulator, Android Emulator, or the Expo Go app on a physical device

### Installation

```bash
git clone https://github.com/amanshakya2001/home-bill-rent-management-project.git
cd home-bill-rent-management-project
npm install
```

To enable AI features create a `.env` file:

```env
EXPO_PUBLIC_OPENAI_API_KEY=sk-...
```

AI features degrade gracefully if the key is absent.

### Running

```bash
expo start
```

Press `i` for iOS Simulator, `a` for Android Emulator, or scan the QR code with Expo Go.

```bash
npm run android   # build and run on Android
npm run ios       # build and run on iOS
npm run web       # run in browser
```

## Project Structure

```
app/
  (tabs)/
    index.tsx        # Dashboard — monthly snapshot and recent activity
    bills.tsx        # Electricity bills list, add/edit form, AI scan
    rent.tsx         # Rent payments list, add/edit form
    analytics.tsx    # Bar charts and yearly stats
    split.tsx        # Bill splitter calculator and history
    settings.tsx     # Apartment name and CSV export
  onboarding.tsx     # First-launch onboarding screen
lib/
  database.ts        # SQLite schema, migrations, all CRUD queries
  openai.ts          # Meter OCR, dashboard insights, message generation
  theme.ts           # Design tokens and useTheme hook
  export.ts          # CSV builder
components/
  ui/                # Card, Pill, BottomSheet, PrimaryButton, FilterPills, etc.
```

## License

MIT
