# Playwright E2E Testing — Design Document

**Date:** 2026-02-18
**Status:** Approved (revised after review)

## Overview

Comprehensive Playwright E2E test suite for AI UniTutor, covering all 18 page routes and key user flows. Uses Page Object Model (POM) architecture with layered fixtures for authentication, test data, and API mocking.

## Decisions

| Decision          | Choice                                                      | Rationale                                                  |
| ----------------- | ----------------------------------------------------------- | ---------------------------------------------------------- |
| Coverage scope    | All pages and flows (18 routes)                             | Full regression protection                                 |
| External services | Real Supabase + Mock Gemini/Stripe                          | Verify real auth/DB, avoid AI/payment costs                |
| Supabase instance | Current development instance                                | Simplest setup, no Docker required                         |
| CI integration    | Local only                                                  | Not integrated into GitHub Actions                         |
| Browsers          | Chromium only                                               | Fast, stable, covers majority of users                     |
| Architecture      | Page Object Model + layered fixtures                        | Maintainable at scale for 20 spec files                    |
| Selector strategy | getByRole > getByLabel > getByPlaceholder > getByText > CSS | No data-testid in codebase; role-based selectors preferred |
| i18n              | Tests run in English by default                             | Language switch test verifies Chinese text                 |

## Out of Scope

- `/auth/callback` — OAuth callback requires email verification, not suitable for E2E
- Visual regression (`toHaveScreenshot()`) — future consideration
- Mobile viewport testing — future consideration (app has `useIsMobile` at 768px breakpoint)
- CI/CD integration — local only for now

## Project Structure

```
playwright.config.ts                # Playwright configuration (project root)
e2e/
├── fixtures/
│   ├── test-data.fixture.ts      # Test data setup/teardown (Supabase cleanup)
│   └── base.fixture.ts           # Combined fixture base class (userPage/adminPage/superAdminPage)
├── pages/
│   ├── LoginPage.ts
│   ├── StudyPage.ts
│   ├── ExamListPage.ts
│   ├── MockExamPage.ts
│   ├── AssignmentPage.ts         # Composes ChatPanel (chat interface)
│   ├── LecturePage.ts            # Composes ChatPanel (chat interface)
│   ├── SettingsPage.ts
│   ├── PersonalizationPage.ts
│   ├── PricingPage.ts
│   ├── HelpPage.ts
│   ├── LandingPage.ts
│   ├── admin/
│   │   ├── AdminCoursesPage.ts
│   │   ├── AdminUsersPage.ts
│   │   ├── AdminKnowledgePage.ts
│   │   └── AdminExamPage.ts
│   └── components/
│       ├── ChatPanel.ts
│       ├── Sidebar.ts
│       └── FullScreenModal.ts
├── helpers/
│   ├── mock-gemini.ts            # Gemini API mock (SSE streaming + error)
│   ├── mock-stripe.ts            # Stripe Checkout/Portal mock
│   ├── mock-document-parse.ts    # Document parse SSE mock (named events)
│   ├── mock-quota.ts             # Quota API mock
│   └── test-accounts.ts          # Test account constants
├── tests/
│   ├── auth.setup.ts             # Auth setup project (login 3 roles, save storageState)
│   ├── auth/
│   │   ├── login.spec.ts         # Login + signup toggle + social buttons
│   │   └── logout.spec.ts
│   ├── study/
│   │   ├── chat-session.spec.ts
│   │   ├── chat-streaming.spec.ts
│   │   ├── mode-selection.spec.ts
│   │   └── image-upload.spec.ts
│   ├── exam/
│   │   ├── exam-list.spec.ts
│   │   └── mock-exam.spec.ts
│   ├── assignment/
│   │   └── assignment-view.spec.ts
│   ├── admin/
│   │   ├── courses.spec.ts
│   │   ├── users.spec.ts
│   │   ├── knowledge.spec.ts     # Includes /admin/knowledge/[id] detail page
│   │   └── exam-papers.spec.ts
│   ├── settings/
│   │   ├── settings.spec.ts
│   │   ├── personalization.spec.ts
│   │   └── help.spec.ts
│   ├── billing/
│   │   └── pricing.spec.ts
│   ├── navigation/
│   │   ├── sidebar.spec.ts
│   │   └── routing-guards.spec.ts
│   └── public/
│       ├── landing.spec.ts
│       └── share.spec.ts
└── .env.e2e                      # E2E environment variables (gitignored)
```

## Authentication Strategy

### Three Role-Based Auth States

| Role          | Purpose            | storageState File        |
| ------------- | ------------------ | ------------------------ |
| `user`        | Regular user flows | `.auth/user.json`        |
| `admin`       | Course admin flows | `.auth/admin.json`       |
| `super_admin` | Super admin flows  | `.auth/super-admin.json` |

### Auth Flow

1. **Setup project** (`tests/auth.setup.ts`) runs before all tests
2. Logs in with pre-created test accounts via real Supabase Auth (email/password)
3. Saves `storageState` to `.auth/` directory for each role
4. Test specs use the appropriate role's storageState via fixtures

**Important notes:**

- Test accounts must be pre-created and email-verified in the development Supabase instance
- Signup (registration) is a toggle mode on the `/login` page, not a separate route
- Signup flow ends with "Check your email" message — does NOT redirect. E2E tests do NOT test signup-then-verify flow
- Google/GitHub social login buttons are present but disabled — tests should assert disabled state

### Fixture Design

```typescript
// base.fixture.ts
import { test as base } from '@playwright/test';

export const test = base.extend<{
  userPage: Page;
  adminPage: Page;
  superAdminPage: Page;
}>({
  userPage: async ({ browser }, use) => {
    const ctx = await browser.newContext({ storageState: 'e2e/.auth/user.json' });
    const page = await ctx.newPage();
    await use(page);
    await ctx.close();
  },
  // adminPage, superAdminPage analogous
});
```

### Test Accounts

Three test accounts must be pre-created in the development Supabase instance:

- `e2e-user@test.local` (role: user)
- `e2e-admin@test.local` (role: course_admin)
- `e2e-superadmin@test.local` (role: super_admin)

Passwords stored in `.env.e2e`, never hardcoded.

### Test Data Cleanup Strategy

Since we use the development Supabase instance, test data must be cleaned up to avoid pollution:

- **afterAll hooks** in test-data.fixture.ts call Supabase admin API to delete test-created data
- **Naming convention**: Test-created entities use `[E2E]` prefix for easy identification and cleanup
- **Scope**: Only data created during test runs is cleaned — pre-existing test accounts are kept

## API Mock Strategy

| Service        | Strategy                | Implementation                                                         |
| -------------- | ----------------------- | ---------------------------------------------------------------------- |
| Supabase Auth  | Real                    | Direct Supabase auth calls                                             |
| Supabase DB    | Real                    | Direct database queries                                                |
| Gemini AI      | Mock via `page.route()` | Intercept `/api/chat/stream`, return mock SSE (plain data format)      |
| Stripe         | Mock via `page.route()` | Intercept `/api/stripe/*`, return mock URLs                            |
| Document Parse | Mock via `page.route()` | Intercept `/api/documents/parse`, return mock SSE (named events)       |
| Quota          | Mock via `page.route()` | Intercept `/api/quota`, return mock usage/limits                       |
| Rate Limiting  | Disabled                | `ENABLE_RATELIMIT=false` in `.env.e2e` (supported by `src/lib/env.ts`) |

### Gemini Mock (SSE Streaming — plain `data:` format)

Chat stream uses plain SSE format (NOT named events):

```typescript
// Success mock
export async function mockGeminiStream(page: Page, response: string) {
  await page.route('**/api/chat/stream', async (route) => {
    const chunks = response.split(' ');
    const body = chunks
      .map((chunk) => `data: ${JSON.stringify({ text: chunk + ' ' })}\n\n`)
      .join('');
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
      body: body + 'data: [DONE]\n\n',
    });
  });
}

// Error mock (SSE error event, not HTTP error)
export async function mockGeminiError(
  page: Page,
  message = 'Rate limit exceeded',
  isLimitError = true,
) {
  await page.route('**/api/chat/stream', async (route) => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
      body: `data: ${JSON.stringify({ error: message, isLimitError })}\n\n`,
    });
  });
}
```

### Document Parse Mock (SSE — named events via `event:` field)

Document parse uses named SSE events (6 event types). Format: `event: <type>\ndata: <json>\n\n`

```typescript
export async function mockDocumentParse(page: Page, documentId = 'test-doc-1') {
  await page.route('**/api/documents/parse', async (route) => {
    const events = [
      `event: document_created\ndata: ${JSON.stringify({ documentId })}\n\n`,
      `event: status\ndata: ${JSON.stringify({ stage: 'parsing_pdf', message: 'Parsing PDF...' })}\n\n`,
      `event: status\ndata: ${JSON.stringify({ stage: 'extracting', message: 'Extracting content...' })}\n\n`,
      `event: progress\ndata: ${JSON.stringify({ current: 1, total: 3 })}\n\n`,
      `event: item\ndata: ${JSON.stringify({ index: 0, type: 'knowledge_point', data: { title: 'Test Point' } })}\n\n`,
      `event: batch_saved\ndata: ${JSON.stringify({ chunkIds: ['chunk-1'], batchIndex: 0 })}\n\n`,
      `event: status\ndata: ${JSON.stringify({ stage: 'complete', message: 'Done' })}\n\n`,
    ].join('');
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
      body: events,
    });
  });
}
```

**Named event types (from `src/lib/sse.ts`):**

| Event              | Data                                                                   |
| ------------------ | ---------------------------------------------------------------------- |
| `status`           | `{ stage, message }` — parsing_pdf/extracting/embedding/complete/error |
| `progress`         | `{ current, total }`                                                   |
| `item`             | `{ index, type, data }` — knowledge_point or question                  |
| `batch_saved`      | `{ chunkIds, batchIndex }`                                             |
| `document_created` | `{ documentId }`                                                       |
| `error`            | `{ message, code }`                                                    |

### Stripe Mock

```typescript
export async function mockStripeCheckout(page: Page) {
  await page.route('**/api/stripe/checkout', async (route) => {
    await route.fulfill({
      status: 200,
      body: JSON.stringify({ url: 'https://checkout.stripe.com/test-session' }),
    });
  });
}

export async function mockStripePortal(page: Page) {
  await page.route('**/api/stripe/portal', async (route) => {
    await route.fulfill({
      status: 200,
      body: JSON.stringify({ url: 'https://billing.stripe.com/test-portal' }),
    });
  });
}
```

### Quota Mock

```typescript
export async function mockQuota(page: Page, usage = 5, dailyLimit = 50) {
  await page.route('**/api/quota', async (route) => {
    await route.fulfill({
      status: 200,
      body: JSON.stringify({
        status: { usage, dailyLimit, remaining: dailyLimit - usage },
        limits: { dailyLimit, maxFileSizeMB: 5 },
      }),
    });
  });
}
```

## Test Case Inventory (20 specs)

### Auth (2 specs)

- **login.spec.ts**: Valid credentials → redirect to /study; invalid credentials → error; empty form validation; signup toggle → password strength indicator → confirm password field; social login buttons visible but disabled
- **logout.spec.ts**: Logout → redirect to /login; protected routes inaccessible after logout

### Study/Chat (4 specs)

- **chat-session.spec.ts**: Create session; list sessions; switch sessions; delete session
- **chat-streaming.spec.ts**: Send message → SSE streaming reply (mocked); loading state; error handling (rate limit)
- **mode-selection.spec.ts**: Switch between Lecture Helper / Assignment Coach / Mock Exam modes
- **image-upload.spec.ts**: Upload image in chat; file size limit validation

### Exam (2 specs)

- **exam-list.spec.ts**: View exam list; filter by course; view exam details
- **mock-exam.spec.ts**: Start mock exam; answer questions; submit; view results

### Assignment (1 spec)

- **assignment-view.spec.ts**: View assignment details; content renders correctly

### Admin (4 specs)

- **courses.spec.ts**: Course list; create course; edit course; document upload (mock parse with named events)
- **users.spec.ts**: User list (super_admin only); role management; permission guard (admin can't access)
- **knowledge.spec.ts**: Knowledge card list; view/edit cards; **navigate to /admin/knowledge/[id] detail page**; view chunks/questions
- **exam-papers.spec.ts**: Exam paper list; view paper details

### Settings (3 specs)

- **settings.spec.ts**: Theme toggle (verify data-mantine-color-scheme change); language switch (verify Chinese text appears); usage bar display (mocked quota)
- **personalization.spec.ts**: View/edit profile; account overview; delete account confirmation modal
- **help.spec.ts**: FAQ accordion expand/collapse; search functionality; contact support link

### Billing (1 spec)

- **pricing.spec.ts**: Pricing page render; upgrade click → mock Stripe redirect; billing toggle (monthly/semester); save badge visibility

### Navigation (2 specs)

- **sidebar.spec.ts**: Sidebar navigation; expand/collapse; navigate to settings/personalization/help
- **routing-guards.spec.ts**: Unauthenticated → redirect to /login; user → can't access /admin

### Public (2 specs)

- **landing.spec.ts**: English landing renders; Chinese `/zh` renders; CTA buttons link to /login
- **share.spec.ts**: Share page content renders; invalid share ID error handling

## i18n Testing Strategy

- **Default language**: All tests run in English (the app default)
- **Language switch test** (in settings.spec.ts): Switches language to Chinese, verifies UI text changes to Chinese, then switches back
- **POM selectors**: Use regex patterns that match both English and Chinese text where needed (e.g., `/start.*free|开始.*体验/i`)
- **Landing page**: Separate tests for `/` (English) and `/zh` (Chinese) routes

## Playwright Configuration

```typescript
// playwright.config.ts (project root — Playwright looks for config in CWD)
{
  testDir: './e2e/tests',
  outputDir: 'test-results',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120_000,
  },
}
```

## Developer Experience

### npm Scripts

```json
{
  "e2e": "npx playwright test",
  "e2e:ui": "npx playwright test --ui",
  "e2e:headed": "npx playwright test --headed",
  "e2e:report": "npx playwright show-report"
}
```

### Running Tests

- `npm run e2e` — headless, all tests
- `npm run e2e:ui` — Playwright UI mode (visual debugging)
- `npm run e2e:headed` — headed mode to watch browser
- `npm run e2e -- --grep "auth"` — run subset by keyword
- `npm run e2e -- tests/admin/` — run subset by directory

### Environment Setup

1. Create 3 test accounts in development Supabase (user/admin/super_admin) — must be email-verified
2. Create `.env.e2e` with Supabase credentials and test account passwords
3. `npx playwright install chromium` to install browser
4. Ensure `npm run dev` starts successfully

### .gitignore Additions

```
# E2E
e2e/.auth/
.env.e2e
test-results/
playwright-report/
```

### Parallelization

- `fullyParallel: true` — different spec files run in parallel
- Tests within same file run serially (may share state)
- Auth setup runs as dependency project before all tests

### Reports

- HTML reporter, viewable via `npm run e2e:report`
- Failed test screenshots saved to `test-results/`
- Traces saved on failure via `trace: 'retain-on-failure'`
