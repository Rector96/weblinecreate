# ROCKCRAF - Supabase Setup & Deployment Guide

This guide explains how to link your Supabase project to ROCKCRAF.

---

## 1. Quick Setup in Supabase Dashboard (2 Minutes)

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard) and create a new project (or select an existing one).
2. On the left navigation bar, click on **SQL Editor**.
3. Click **New Query** (or "+").
4. Open the file `supabase_schema.sql` located in this project's root directory, copy its entire contents, and paste them into the SQL Editor.
5. Click **Run** (or press `Cmd + Enter` / `Ctrl + Enter`).
6. You will see `Success. No rows returned`. All tables, multi-tenant RLS security policies, triggers, and storage buckets (`school-logos`, `exam-assets`) are now ready!

---

## 2. Connect Your App Environment Variables

In your Netlify environment variables or local `.env` file, set:

```bash
VITE_SUPABASE_URL="https://YOUR_PROJECT_ID.supabase.co"
VITE_SUPABASE_ANON_KEY="YOUR_SUPABASE_ANON_KEY"
VITE_PAYSTACK_PUBLIC_KEY="pk_live_your_paystack_public_key"
PAYSTACK_SECRET_KEY="sk_live_your_paystack_secret_key"
GEMINI_API_KEY="your-gemini-api-key"
```

You can find your `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in:
**Project Settings** -> **API** -> **Project URL** and **Project API keys (anon public)**.

---

## 3. Database Architecture Overview

| Table | Multi-Tenant Key | Purpose |
|---|---|---|
| `schools` | `id` | Nigerian secondary schools, LGA, State, subscription status (trial / active). |
| `profiles` | `school_id` | User profiles linked to `auth.users(id)`. |
| `user_roles` | `school_id` | Strict RBAC (`school_admin`, `teacher`, `platform_admin`). |
| `school_classes` | `school_id` | Classes (JSS 1 through SSS 3) with customized arms. |
| `school_invitations` | `school_id` | 6-character tokens (`KC2026`) for teacher `/join/:token` onboarding. |
| `exams` | `school_id` | Complete WAEC/JAMB exam metadata, instructions, and marks. |
| `questions` | `school_id` | Section A (Objective) and Section B (Theory) question stems. |
| `objective_answers` | via `question_id` | Options A, B, C, D and correct answer key. |
| `theory_marking_schemes` | via `question_id` | Confidential model answers and point breakdown rubrics. |
| `payments` | `school_id` | Paystack ₦11,000 per term transaction records. |

---

## 4. Multi-Tenant Security & Row Level Security (RLS)

- **Platform Admin**: The email `peteroche32@gmail.com` has automatic global administrative access across all schools.
- **School Admins**: Have full control over their school's classes, teachers, profile settings, and exams.
- **Teachers**: Can generate and manage exams for their school and view their school's classes.
- **Storage**: Logos and exam assets are stored in the `school-logos` and `exam-assets` buckets with public read and authenticated write access.
