import type { MockNote } from '@onpoint/app-preview'

const now = Date.now()

export const MOCK_NOTES: MockNote[] = [
  // ─── Sales Professional ───
  {
    relativePath: 'Sales/Q1 Pipeline Review.md',
    title: 'Q1 Pipeline Review',
    mtimeMs: now - 1800000,
    content: `---
title: Q1 Pipeline Review
---

## Pipeline Summary

| Stage | Deals | Value |
|-------|-------|-------|
| Prospecting | 34 | $420K |
| Discovery | 18 | $310K |
| Proposal | 8 | $280K |
| Negotiation | 5 | $195K |
| **Closed Won** | **12** | **$540K** |

## Key Deals This Week

- **Acme Corp** — Enterprise license, $85K. Champion is VP of Ops. Demo went well, sending proposal Friday.
- **Bloom Health** — Expansion from 50 → 200 seats. Need to loop in their IT for SSO requirements.
- **Coastline Media** — New logo. They're comparing us against two competitors. Differentiator: our offline-first approach.

## Action Items

- [ ] Follow up with Acme Corp by Friday
- [ ] Send Bloom Health the SSO integration docs
- [x] Prep competitive battle card for Coastline
- [ ] Update forecast in CRM

> Focus on Acme and Bloom this week — highest close probability.`
  },
  {
    relativePath: 'Sales/Discovery Call Template.md',
    title: 'Discovery Call Template',
    mtimeMs: now - 86400000,
    content: `---
title: Discovery Call Template
---

## Opening (2 min)

Thanks for taking the time. I've done some research on [company] — love what you're doing with [recent initiative]. Today I'd like to understand your workflow and see if there's a fit.

## Situation Questions (5 min)

- How does your team currently capture and share knowledge?
- What tools are you using today? What's working, what isn't?
- How many people on the team need access?

## Pain Questions (5 min)

- What happens when someone can't find a document they need?
- How much time does your team spend searching for information?
- Have you tried solving this before? What happened?

## Impact (3 min)

- If you could get that time back, what would you do with it?
- What would it mean for onboarding new hires?

## Next Steps (2 min)

- [ ] Confirm decision-makers
- [ ] Schedule follow-up demo
- [ ] Send pricing overview`
  },

  // ─── YouTuber / Content Creator ───
  {
    relativePath: 'Content/Video Script — 10 Productivity Hacks.md',
    title: 'Video Script — 10 Productivity Hacks',
    mtimeMs: now - 3600000,
    content: `---
title: "Video Script — 10 Productivity Hacks"
---

## Hook (0:00–0:15)

"I tested 50 productivity methods for 30 days. These 10 actually stuck."

## Intro (0:15–0:45)

Quick montage of failed attempts — color-coded spreadsheets, 5am wake-ups, the Pomodoro timer collecting dust. Then: "Here's what actually works for real people."

## The List

1. **Two-Minute Rule** — If it takes less than 2 min, do it now
2. **Weekly Review** — 30 min every Sunday to plan the week
3. **Inbox Zero** — Process, don't just read
4. **Time Blocking** — Calendar is your to-do list
5. **Single-Tasking** — Close everything else
6. **Energy Mapping** — Hard tasks when you're sharpest
7. **Templates** — Don't start from scratch
8. **Capture Everything** — Your brain is for thinking, not storing
9. **Say No** — Protect your calendar
10. **Reflect Daily** — 5 min journal at end of day

## CTA (9:30–10:00)

"Which of these are you going to try first? Drop it in the comments. And if you want the Notion template I use for weekly reviews, link in the description."

## Notes

- B-roll needed: desk setup, phone notifications, calendar app
- Sponsor segment at 3:00 mark
- Thumbnail options: "10 HACKS" with shocked face vs. clean minimal`
  },
  {
    relativePath: 'Content/Channel Strategy 2025.md',
    title: 'Channel Strategy 2025',
    mtimeMs: now - 172800000,
    content: `---
title: Channel Strategy 2025
---

## Content Pillars

1. **Productivity & Tools** — Reviews, workflows, systems (40%)
2. **Behind the Scenes** — Building in public, creator journey (30%)
3. **Tutorials** — Step-by-step guides for specific tools (30%)

## Upload Schedule

- **Tuesday** — Main video (8–12 min)
- **Thursday** — Short-form / Shorts
- **Saturday** — Community Q&A or collab

## Growth Targets

- Subscribers: 50K → 100K
- Average views: 15K → 30K
- Revenue: Diversify beyond AdSense (sponsors, courses)

## Ideas Backlog

- [ ] "I replaced all my apps with plain text files"
- [ ] "The $0 productivity stack"
- [ ] "How I write scripts in 30 minutes"
- [x] "10 Productivity Hacks" (filming this week)
- [ ] Collab with @TechMinimalist`
  },

  // ─── Engineer ───
  {
    relativePath: 'Projects/API Design Patterns.md',
    title: 'API Design Patterns',
    mtimeMs: now - 7200000,
    content: `---
title: API Design Patterns
---

## Resource Naming Conventions

Use plural nouns for collections. Keep URLs lowercase with hyphens for readability.

\`\`\`
GET  /api/v1/users
POST /api/v1/users
GET  /api/v1/users/:id/notes
\`\`\`

## Pagination Strategy

Cursor-based pagination scales better than offset-based for large datasets. Always return next/prev links.

- Use cursor tokens, not page numbers
- Default limit: 25, max: 100
- Include total count in response headers

## Error Handling

Return consistent error shapes across all endpoints:

\`\`\`json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "User not found",
    "details": {}
  }
}
\`\`\`

> Always use HTTP status codes correctly. 4xx for client errors, 5xx for server errors.`
  },
  {
    relativePath: 'Projects/Architecture Decision.md',
    title: 'Architecture Decision',
    mtimeMs: now - 10800000,
    content: `---
title: Architecture Decision
---

## ADR-001: Monorepo Structure

**Status:** Accepted

**Context:** We need to share code between the desktop app, CLI, and marketing site while keeping deployments independent.

**Decision:** Use pnpm workspaces with the following structure:

- \`apps/desktop\` — Electron app
- \`apps/cli\` — Command-line tool
- \`apps/marketing\` — Website
- \`packages/shared\` — Common utilities
- \`packages/ui\` — Shared React components

**Consequences:**
- Single \`pnpm install\` for all packages
- Atomic commits across packages
- Shared TypeScript configuration`
  },

  // ─── Daily Notes (relatable to everyone) ───
  {
    relativePath: 'Daily Notes/2025-02-27.md',
    title: '2025-02-27',
    mtimeMs: now - 900000,
    content: `---
title: "2025-02-27"
---

## Morning

- Team sync at 9:30 — review Q1 goals
- Reply to Sarah's email about the partnership proposal
- Book flights for next week's conference

## Afternoon

- [ ] Finalize slide deck for Thursday's presentation
- [ ] Review draft blog post
- [ ] 1:1 with Jamie at 3pm

## Ideas

Had an interesting thought during coffee — what if we bundled the onboarding flow into a 3-minute video instead of a 10-step wizard? People don't read. They watch.

## End of Day

Good day. Got the slides 80% done. Jamie's 1:1 went well — she's ready to lead the next sprint.`
  },
  {
    relativePath: 'Daily Notes/2025-02-26.md',
    title: '2025-02-26',
    mtimeMs: now - 86400000,
    content: `---
title: "2025-02-26"
---

## Tasks

- [x] Ship the new landing page
- [x] Fix the search index bug
- [ ] Write release notes for v2.1
- [x] Lunch with Alex — discussed collab idea

## Notes

Alex mentioned their team spends 2+ hours/week just searching for meeting notes. That's our value prop right there.`
  },

  // ─── General / Power User ───
  {
    relativePath: 'Reading List.md',
    title: 'Reading List',
    mtimeMs: now - 43200000,
    content: `---
title: Reading List
---

## Currently Reading

- **Build** by Tony Fadell — Lessons from building the iPod and Nest
- **Obviously Awesome** by April Dunford — Positioning for tech products

## Up Next

- *The Mom Test* — How to talk to customers
- *Continuous Discovery Habits* — Product discovery framework
- *Show Your Work* — Building in public

## Finished

- [x] *Atomic Habits* — James Clear
- [x] *Zero to One* — Peter Thiel
- [x] *The Design of Everyday Things* — Don Norman

> "The best time to plant a tree was 20 years ago. The second best time is now."`
  },
  {
    relativePath: 'Meeting Notes/Weekly Team Sync.md',
    title: 'Weekly Team Sync',
    mtimeMs: now - 14400000,
    content: `---
title: Weekly Team Sync
---

## Attendees

Sarah, Jamie, Alex, Marcus

## Updates

**Sarah** — Marketing site is live. Early traffic numbers look good. 2.3K visits in first 24 hours.

**Jamie** — Sprint is on track. Search feature ships Wednesday. Ghost mode polish for Friday.

**Alex** — Three new enterprise leads from the conference. Scheduling demos for next week.

**Marcus** — Design system docs updated. New icon set ready for review.

## Decisions

- Launch ProductHunt on March 5th
- Pricing stays simple: free tier + $8/mo pro
- Jamie leads the CLI integration sprint next

## Action Items

- [ ] Sarah: Write launch blog post
- [ ] Alex: Prep enterprise demo deck
- [ ] Marcus: Share icon set in Figma
- [ ] Jamie: Scope CLI plugin system`
  }
]
