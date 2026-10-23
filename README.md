# ExamCraft — Nigerian Secondary School Exam Paper Generator (PWA)

ExamCraft is a multi-tenant SaaS Progressive Web App engineered specifically for Nigerian secondary schools (JSS 1 to SSS 3). It empowers school administrators and subject teachers to create high-quality examination question papers (Objective + Theory) manually or with AI, complete with official 12pt Times New Roman DOCX exports and confidential marking schemes.

---

## 🌟 Key Features

1. **Native Mobile-First Design (billflow-express / RockPay inspired)**
   - Plus Jakarta Sans typography.
   - Soft rounded cards (`rounded-2xl` / `rounded-3xl`), subtle shadows, and generous touch targets ($\ge 44\text{px}$).
   - Floating bottom dock navigation on mobile (`Home | Exams | Create | Classes | School`).
   - Clean desktop sidebar navigation.
   - Refined purple/violet primary accents with light gray backgrounds.
   - Zero marketing landing page — unauthenticated users land directly at Login / Sign Up / Join with Token.

2. **Exam Paper DOCX Export**
   - Exact official layout: Centered school name (16pt bold), motto, address, exam title, subject, class, session, time allowed, with no candidate-name or class/arm lines.
   - **Section A**: Objectives with lettered options [A] [B] [C] [D].
   - **Section B**: Theory questions with allocated marks in brackets `[15 Marks]`.
   - **Confidential Marking Scheme DOCX**: Separate document containing objective answer grid and step-by-step scoring rubrics (restricted to school admins and examiners).
   - Batch download all exams as a `.zip` archive.

3. **Multi-Step Exam Creation Wizard**
   - **Step 1**: Exam Metadata (Subject, Class, Term, Session, Duration, Instructions).
   - **Step 2**: Method choice (AI Question Generator vs. Manual Authoring).
   - **Step 3a (Manual)**: Scientific symbol keyboard (², ³, √, π, θ, λ, α, β, Δ, etc.), speech-to-text voice microphone dictation (Web Speech API).
   - **Step 3b (AI Generation)**: Edge function proxying Gemini 2.5 Flash / Flash-Lite covering Nigerian curriculum topics with automatic multi-provider fallback.
   - **Step 4**: Live paper preview with full inline editing before finalization.
   - **Step 5**: Atomic write + trial consumption + celebration confetti.

4. **Multi-Tenancy & Roles**
   - `school_admin`: Full management of school profile, teachers, classes, and exams.
   - `teacher`: Authors exams for their subjects inside the school.
   - `platform_admin`: Super-admin console (`peteroche32@gmail.com`) managing all registered schools, trial usage, and revenue.
   - 6-character uppercase teacher invite tokens (e.g. `KC2026` or `/join/:token`).
   - Profile completion gate: Users must complete mandatory school details (Name, State, LGA, Institution type, Phone) before creating exams.

5. **Pricing & Paystack (₦ Pricing)**
   - Free Trial: 3 AI exams + 5 manual exams.
   - Paid Plan: ₦11,000 per school term via Paystack (`/api/initialize-payment`).

6. **PWA & Offline Capability**
   - Installable PWA with Service Worker (`vite-plugin-pwa`).
   - In-app install banner and iOS Safari guide modal.
   - Offline banner and local draft auto-saving.

---

## 🛠 Tech Stack

- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, Lucide Icons, Canvas Confetti.
- **Backend / API**: Express, Node.js (`server.ts`), `@google/genai` TypeScript SDK.
- **Document Engine**: `docx` and `jszip` + `file-saver`.
- **Database / Auth**: Supabase PostgreSQL schema with RLS (`supabase/migrations/20260101_init.sql`) and built-in local persistence synchronization engine.
- **Payments**: Paystack (₦11,000 / term).

---

## 🚀 Setup & Local Development

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Ensure `GEMINI_API_KEY` is provided for server-side AI generation.

### 3. Start Development Server
```bash
npm run dev
```
The server will start on `http://localhost:3000`.

### 4. Build for Production
```bash
npm run build
npm start
```

---

## 🗄 Supabase Migration
To apply the database schema to your Supabase project, execute `supabase/migrations/20260101_init.sql` in the Supabase SQL Editor.
