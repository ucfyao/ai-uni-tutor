# Playwright E2E Testing — Design Document

**Date:** 2026-02-18
**Status:** Approved

## Overview

Comprehensive Playwright E2E test suite for AI UniTutor, covering all 17+ routes and key user flows. Uses Page Object Model (POM) architecture with layered fixtures for authentication, test data, and API mocking.

## Decisions

| Decision          | Choice                               | Rationale                                   |
| ----------------- | ------------------------------------ | ------------------------------------------- |
| Coverage scope    | All pages and flows                  | Full regression protection                  |
| External services | Real Supabase + Mock Gemini/Stripe   | Verify real auth/DB, avoid AI/payment costs |
| Supabase instance | Current development instance         | Simplest setup, no Docker required          |
| CI integration    | Local only                           | Not integrated into GitHub Actions          |
| Browsers          | Chromium only                        | Fast, stable, covers majority of users      |
| Architecture      | Page Object Model + layered fixtures | Maintainable at scale for 21+ spec files    |

## Project Structure

```
e2e/
├── playwright.config.ts          # Playwright configuration
├── fixtures/
│   ├── auth.fixture.ts           # Auth fixture (login state reuse via storageState)
│   ├── test-data.fixture.ts      # Test data setup/teardown
│   └── base.fixture.ts           # Combined fixture base class
├── pages/
│   ├── LoginPage.ts
│   ├── StudyPage.ts
│   ├── ExamListPage.ts
│   ├── MockExamPage.ts
│   ├── AssignmentPage.ts
│   ├── LecturePage.ts
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
│   ├── mock-gemini.ts            # Gemini API mock (SSE streaming)
│   ├── mock-stripe.ts            # Stripe Checkout/Portal mock
│   ├── mock-document-parse.ts    # Document parse SSE mock
│   ├── test-accounts.ts          # Test account constants
│   └── selectors.ts              # Shared selector constants
├── tests/
│   ├── auth/
│   │   ├── login.spec.ts
│   │   ├── signup.spec.ts
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
│   │   ├── knowledge.spec.ts
│   │   └── exam-papers.spec.ts
│   ├── settings/
│   │   ├── settings.spec.ts
│   │   └── personalization.spec.ts
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

1. **Setup project** (`auth.setup.ts`) runs before all tests
2. Logs in with pre-created test accounts via real Supabase Auth
3. Saves `storageState` to `.auth/` directory for each role
4. Test specs use the appropriate role's storageState via fixtures

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
    const ctx = await browser.newContext({ storageState: '.auth/user.json' });
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

## API Mock Strategy

| Service        | Strategy                | Implementation                                             |
| -------------- | ----------------------- | ---------------------------------------------------------- |
| Supabase Auth  | Real                    | Direct Supabase auth calls                                 |
| Supabase DB    | Real                    | Direct database queries                                    |
| Gemini AI      | Mock via `page.route()` | Intercept `/api/chat/stream`, return mock SSE              |
| Stripe         | Mock via `page.route()` | Intercept `/api/stripe/*`, return mock URLs                |
| Document Parse | Mock via `page.route()` | Intercept `/api/documents/parse`, return mock SSE progress |
| Rate Limiting  | Disabled                | `ENABLE_RATELIMIT=false` in `.env.e2e`                     |

### Gemini Mock (SSE Streaming)

```typescript
export async function mockGeminiStream(page: Page, response: string) {
  await page.route('**/api/chat/stream', async (route) => {
    const chunks = response.split(' ');
    const body = chunks.map((chunk) => `data: {"text":"${chunk} "}\n\n`).join('');
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
      body: body + 'data: [DONE]\n\n',
    });
  });
}
```

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
```

## Test Case Inventory (21 specs)

### Auth (3 specs)

- **login.spec.ts**: Valid credentials → redirect to /study; invalid credentials → error; empty form validation
- **signup.spec.ts**: Full signup flow; password strength indicator; duplicate email error
- **logout.spec.ts**: Logout → redirect to /login; protected routes inaccessible after logout

### Study/Chat (4 specs)

- **chat-session.spec.ts**: Create session; list sessions; switch sessions; delete session
- **chat-streaming.spec.ts**: Send message → SSE streaming reply (mocked); loading state
- **mode-selection.spec.ts**: Switch between Lecture Helper / Assignment Coach / Mock Exam modes
- **image-upload.spec.ts**: Upload image in chat; file size limit validation

### Exam (2 specs)

- **exam-list.spec.ts**: View exam list; filter by course; view exam details
- **mock-exam.spec.ts**: Start mock exam; answer questions; submit; view results

### Assignment (1 spec)

- **assignment-view.spec.ts**: View assignment details; content renders correctly

### Admin (4 specs)

- **courses.spec.ts**: Course list; create course; edit course; document upload (mock parse)
- **users.spec.ts**: User list (super_admin only); role management; permission guard (admin can't access)
- **knowledge.spec.ts**: Knowledge card list; view/edit cards
- **exam-papers.spec.ts**: Exam paper list; view paper details

### Settings (2 specs)

- **settings.spec.ts**: Theme toggle; language switch (EN↔ZH); settings persistence
- **personalization.spec.ts**: View/edit profile; account overview

### Billing (1 spec)

- **pricing.spec.ts**: Pricing page render; upgrade click → mock Stripe redirect; billing toggle (monthly/semester)

### Navigation (2 specs)

- **sidebar.spec.ts**: Sidebar navigation; expand/collapse
- **routing-guards.spec.ts**: Unauthenticated → redirect to /login; user → can't access /admin

### Public (2 specs)

- **landing.spec.ts**: English landing renders; Chinese `/zh` renders; CTA buttons work
- **share.spec.ts**: Share page content renders; invalid share ID error handling

## Playwright Configuration

```typescript
// playwright.config.ts key settings
{
  testDir: './e2e/tests',
  fullyParallel: true,
  retries: 0,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
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
  },
}
```

## Developer Experience

### npm Scripts

```json
{
  "e2e": "playwright test",
  "e2e:ui": "playwright test --ui",
  "e2e:headed": "playwright test --headed",
  "e2e:report": "playwright show-report"
}
```

### Running Tests

- `npm run e2e` — headless, all tests
- `npm run e2e:ui` — Playwright UI mode (visual debugging)
- `npm run e2e:headed` — headed mode to watch browser
- `npm run e2e -- --grep "auth"` — run subset by keyword
- `npm run e2e -- tests/admin/` — run subset by directory

### Environment Setup

1. Create 3 test accounts in development Supabase (user/admin/super_admin)
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
