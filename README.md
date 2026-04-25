# Home Bill & Rent Manager

A React Native mobile app for managing household electricity bills and rent payments — with AI-powered meter scanning, spending insights, and bill splitting.

Built with Expo SDK 54, SQLite for offline-first storage, and OpenAI GPT-4o.

---

## Features

### Dashboard
- Monthly snapshot of electricity and rent status
- Pending payment alert with total amount due
- Recent activity feed across bills and rent
- AI-powered spending insights (tap Refresh to analyze)

### Electricity Bills
- Log monthly bills with previous and current meter readings
- Auto-calculate units consumed and total amount
- **AI meter scan** — photograph your meter to auto-fill the reading using GPT-4o Vision
- Attach meter photos to each bill record
- Mark bills as paid / unpaid
- Due date push notification (1 day before)

### Rent Payments
- Track monthly rent with configurable due dates
- Mark as paid with automatic date stamping
- Due date push notification (1 day before)

### Bill Splitter
- Split a shared electricity bill across up to three floors (Our Floor, Top Floor, Underground)
- Live per-unit rate and per-party breakdown
- **Generate a formatted WhatsApp message** with AI — one tap to copy and send

### Settings
- Custom apartment name shown on the dashboard
- Default due days for bills and rent (pre-filled when adding new entries)
- Toggle push notifications on/off

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React Native 0.81 + Expo SDK 54 |
| Navigation | Expo Router (file-based) |
| Database | expo-sqlite (local, offline-first) |
| AI | OpenAI GPT-4o (vision + chat) |
| Notifications | expo-notifications |
| Language | TypeScript |

---

## Project Structure

```
app/
  (tabs)/
    index.tsx       # Dashboard
    bills.tsx       # Electricity bills
    rent.tsx        # Rent payments
    split.tsx       # Bill splitter
    settings.tsx    # App settings
  _layout.tsx       # Root layout with SQLite provider

lib/
  database.ts       # SQLite schema, migrations & all queries
  openai.ts         # OpenAI API integration (meter scan, insights, message)
  notifications.ts  # Push notification scheduling & cancellation

assets/images/      # App icons and splash screen
constants/
  theme.ts          # Shared colors / design tokens
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- [Expo CLI](https://docs.expo.dev/get-started/installation/)
- An [OpenAI API key](https://platform.openai.com/api-keys) (for AI features)
- iOS Simulator / Android Emulator, or the [Expo Go](https://expo.dev/client) app

### Installation

```bash
# 1. Clone the repository
git clone <repo-url>
cd home-bill-rent-management

# 2. Install dependencies
npm install

# 3. Create a .env file in the project root
echo "EXPO_PUBLIC_OPENAI_API_KEY=your_openai_api_key_here" > .env

# 4. Start the development server
npx expo start
```

Press `i` to open iOS Simulator, `a` for Android, or scan the QR code with Expo Go.

### Build native (optional)

The `ios/` and `android/` folders are excluded from git (they are generated). To run on a physical device or build locally:

```bash
npx expo prebuild       # generate native folders
npx expo run:ios        # build and run on iOS
npx expo run:android    # build and run on Android
```

---

## Environment Variables

Create a `.env` file in the project root (never commit this file):

```env
EXPO_PUBLIC_OPENAI_API_KEY=sk-...
```

| Variable | Required | Description |
|---|---|---|
| `EXPO_PUBLIC_OPENAI_API_KEY` | Yes | OpenAI API key — used for meter scanning, dashboard insights, and WhatsApp message generation |

> AI features will show a friendly error message if the key is missing or invalid, so the rest of the app remains fully functional without it.

---

## Database Schema

Data is stored locally on-device using SQLite. Three tables:

- **`electricity_bills`** — month, year, previous/current readings, units consumed, price per unit, total amount, due date, status, meter photo URI, notification ID
- **`rent_payments`** — month, year, amount, due date, status, paid date, notification ID
- **`app_settings`** — apartment name, default bill due day, default rent due day, notifications toggle

The schema is initialized on first launch and migrations run automatically on upgrade.

---

## License

MIT
