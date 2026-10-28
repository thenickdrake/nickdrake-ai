# `nickdrake.ai` · Nick Drake's Personal Second Brain & Executive Assistant

This directory contains the production web application for **`nickdrake.ai`**, backed directly by the Supabase Postgres database **`tjnvjsjlyjcmrjyyslaa`** (`Second Brain`) with strict Postgres Row-Level Security (`public.is_nick_owner()`) and the `ask-grok` Edge Function.

> **Design Separation:** Church Health & Engagement analytics and scorecards live on their own dedicated dashboard (`d567720f-f6e1-4cd0-8299-e1fb22f0933c`). `nickdrake.ai` is designed purely as Nick's **Personal Assistant & Second Brain**.

---

## Core Personal Assistant Tabs

1. **Today & 1:1 Prep (`tab-today`)**
   - Upcoming 1:1 talking points, coaching notes, and open loops for **Kalie Drake**, **Joe Suro**, **Josh Price**, **Pastor Parker Womack**, **Pastor Tyler**, and **Ashley Brown**.
   - Priority write-ready follow-ups extracted from recent conversations (`public.sb_profile_items`) with 1-click **"Turn into Task"** (`public.convert_profile_item_to_task`).
   - Quick Thought / Voice Debrief capture (`public.journal`) and Waiting On tracker (`public.waiting_on`).
2. **People Profiles (`tab-people-profiles` · 30 Key Relationships)**
   - Synthesized from `public.sb_person_profiles` with **Who They Are**, **What They're Focused On Right Now**, **Why This Relationship Matters**, **Coaching & Communication Notes**, **Recent Interactions** across all 6 sources, deep links to original conversations, and 1-click **"Turn into Task"** buttons.
3. **Project Profiles (`tab-project-profiles` · 16 Active Initiatives)**
   - Synthesized from `public.sb_project_profiles` (`Heathrow Transition`, `Christmas Store 2026`, `Sanford Growth & Seating`, `November Encounter`, `Highlands Trip`, `nickdrake.ai`, etc.) with **Who / What / Why**, key milestones & decisions, stakeholders, source links, and **"Turn into Task"** action lines.
4. **Open Loops, Tasks & 1:1 Agendas (`tab-loops`)**
   - Clean personal assistant task manager (`mine`, `theirs`, `agenda`, `Kalie 1:1`, `Pastor Tyler`, `Locations`, `Staff Meeting`) reading and writing `public.tasks`.
5. **Memory Feed (`tab-memory` · 6 Sources · 110 Distilled Items + Cost Audit)**
   - Searchable feed of 110 distilled interactions across **Slack** (22), **iMessage** (20), **Google Drive** (20), **Plaud Recordings** (24), **Meeting Notes** (12), and **Email** (12).
   - Every item stores **Who**, **What**, and **Why It Matters** plus a direct `source_url` link back to the original message or document (zero raw message dumps).
   - Includes the **Phase 1 Ingestion & Summarizer Cost Audit** (`public.sb_ingestion_runs`).
6. **Plaud & Briefs (`tab-briefs`)**
   - Executive assistant briefs (`public.briefs`) and 30 distilled Plaud voice recordings (`public.plaud_recordings`).
7. **Assistant Bots & Docs (`tab-bots`)**
   - Second Brain SOP & Reference library (`public.second_brain_docs`), 8-Seat Assistant Bot Team (`public.bot_team_roster`), and 22 scheduled routines (`public.bot_routines`).

---

## Deploying to Vercel (`nickdrake.ai`)

```bash
cd /workspace/nickdrake-ai
npx vercel --prod
```
Or upload `/workspace/nickdrake-ai-vercel.zip` to Vercel and attach custom domain `nickdrake.ai`.
