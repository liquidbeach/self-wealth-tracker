# Self Wealth Tracker

Personal investment management with Buffett-style stock assessment.

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy the example env file:
```bash
cp .env.local.example .env.local
```

Edit `.env.local` and add your Supabase credentials:
- Go to [Supabase Dashboard](https://supabase.com/dashboard)
- Select your project
- Go to **Project Settings** > **API**
- Copy **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- Copy **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Create an Account

1. Go to `/signup`
2. Enter your details
3. Check your email for confirmation link
4. Click the link to activate
5. Log in and start using the app

---

## Deploy to Vercel

### Option A: Via Vercel Dashboard (Recommended)

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Click "New Project"
4. Import your GitHub repository
5. Add Environment Variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
6. Click Deploy

### Option B: Via CLI

```bash
npm install -g vercel
vercel
```

Follow the prompts and add your environment variables.

---

## Configure Supabase Auth Redirect

After deploying, update Supabase:

1. Go to Supabase Dashboard > Authentication > URL Configuration
2. Add your Vercel URL to:
   - **Site URL**: `https://your-app.vercel.app`
   - **Redirect URLs**: `https://your-app.vercel.app/auth/callback`

---

## Project Structure

```
src/
├── app/
│   ├── (auth)/           # Login, signup pages
│   │   ├── login/
│   │   ├── signup/
│   │   └── auth/callback/
│   ├── (app)/            # Main app (protected)
│   │   ├── dashboard/
│   │   ├── portfolio/
│   │   ├── watchlist/
│   │   ├── assessor/
│   │   ├── risk/
│   │   ├── research/
│   │   └── settings/
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── components/
│   ├── Sidebar.tsx
│   └── Header.tsx
├── lib/
│   ├── supabase.ts       # Browser client
│   └── supabase-server.ts # Server client
└── types/
    └── database.ts       # TypeScript types
```

---

## Features (Planned)

- [x] Authentication (Email)
- [x] Dashboard
- [ ] Portfolio Tracker
- [ ] Watchlist
- [ ] Stock Assessor
- [ ] Risk Management
- [ ] Research Hub

---

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: Supabase (PostgreSQL)
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Charts**: Recharts (coming soon)

---

## License

Private - Personal Use
