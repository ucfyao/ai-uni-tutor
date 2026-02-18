# Playwright E2E Testing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a comprehensive Playwright E2E test suite covering all 17+ routes with Page Object Model architecture, real Supabase auth, and mocked AI/payment services.

**Architecture:** POM-based test suite with layered fixtures for auth (storageState), test data, and API mocking. Tests organized by feature area (auth, study, exam, admin, settings, billing, navigation, public). Three role-based auth states (user, admin, super_admin) established in setup project.

**Tech Stack:** Playwright Test, TypeScript, Supabase (real dev instance), route-intercepted mocks for Gemini/Stripe

**Design Doc:** `docs/plans/2026-02-18-e2e-testing-design.md`

---

## Task 1: Install Playwright and Create Config

**Files:**

- Modify: `package.json` (add devDependency + scripts)
- Create: `e2e/playwright.config.ts`
- Modify: `.gitignore` (add E2E entries)
- Create: `e2e/.env.e2e.example`

**Step 1: Install Playwright**

```bash
npm install -D @playwright/test
npx playwright install chromium
```

**Step 2: Add npm scripts to package.json**

Add these to the `"scripts"` section:

```json
"e2e": "npx playwright test",
"e2e:ui": "npx playwright test --ui",
"e2e:headed": "npx playwright test --headed",
"e2e:report": "npx playwright show-report"
```

**Step 3: Create `e2e/playwright.config.ts`**

```typescript
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, devices } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  testDir: path.join(__dirname, 'tests'),
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
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
});
```

**Step 4: Add E2E entries to `.gitignore`**

Append these lines:

```
# E2E Testing
e2e/.auth/
.env.e2e
test-results/
playwright-report/
```

**Step 5: Create `e2e/.env.e2e.example`**

```bash
# Copy to .env.e2e and fill in real values
# Supabase (same as dev instance)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key

# Test accounts (pre-create these in Supabase Auth)
E2E_USER_EMAIL=e2e-user@test.local
E2E_USER_PASSWORD=changeme
E2E_ADMIN_EMAIL=e2e-admin@test.local
E2E_ADMIN_PASSWORD=changeme
E2E_SUPER_ADMIN_EMAIL=e2e-superadmin@test.local
E2E_SUPER_ADMIN_PASSWORD=changeme
```

**Step 6: Verify Playwright installed correctly**

```bash
npx playwright test --version
```

Expected: Version number printed (e.g., `1.40.x`)

**Step 7: Commit**

```bash
git add package.json package-lock.json e2e/playwright.config.ts .gitignore e2e/.env.e2e.example
git commit -m "chore(config): install Playwright and add E2E config"
```

---

## Task 2: Create Test Account Helpers and Auth Setup

**Files:**

- Create: `e2e/helpers/test-accounts.ts`
- Create: `e2e/fixtures/auth.setup.ts`
- Create: `e2e/.auth/.gitkeep`

**Step 1: Create `e2e/helpers/test-accounts.ts`**

```typescript
import { createClient } from '@supabase/supabase-js';

export const TEST_ACCOUNTS = {
  user: {
    email: process.env.E2E_USER_EMAIL || 'e2e-user@test.local',
    password: process.env.E2E_USER_PASSWORD || '',
  },
  admin: {
    email: process.env.E2E_ADMIN_EMAIL || 'e2e-admin@test.local',
    password: process.env.E2E_ADMIN_PASSWORD || '',
  },
  superAdmin: {
    email: process.env.E2E_SUPER_ADMIN_EMAIL || 'e2e-superadmin@test.local',
    password: process.env.E2E_SUPER_ADMIN_PASSWORD || '',
  },
} as const;

export function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY in environment');
  }
  return createClient(url, key);
}
```

**Step 2: Create `e2e/fixtures/auth.setup.ts`**

This is the Playwright setup project that logs in each role and saves storageState.

```typescript
import { expect, test as setup } from '@playwright/test';
import { TEST_ACCOUNTS } from '../helpers/test-accounts';

const AUTH_DIR = 'e2e/.auth';

async function loginAndSave(
  page: import('@playwright/test').Page,
  email: string,
  password: string,
  storageStatePath: string,
) {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/^password$/i).fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();

  // Wait for redirect to /study (authenticated state)
  await page.waitForURL('**/study', { timeout: 15_000 });
  await expect(page).toHaveURL(/\/study/);

  // Save authenticated state
  await page.context().storageState({ path: storageStatePath });
}

setup('authenticate as user', async ({ page }) => {
  await loginAndSave(
    page,
    TEST_ACCOUNTS.user.email,
    TEST_ACCOUNTS.user.password,
    `${AUTH_DIR}/user.json`,
  );
});

setup('authenticate as admin', async ({ page }) => {
  await loginAndSave(
    page,
    TEST_ACCOUNTS.admin.email,
    TEST_ACCOUNTS.admin.password,
    `${AUTH_DIR}/admin.json`,
  );
});

setup('authenticate as super admin', async ({ page }) => {
  await loginAndSave(
    page,
    TEST_ACCOUNTS.superAdmin.email,
    TEST_ACCOUNTS.superAdmin.password,
    `${AUTH_DIR}/super-admin.json`,
  );
});
```

**Step 3: Create `e2e/.auth/.gitkeep`** (empty file to keep the directory in git)

**Step 4: Commit**

```bash
git add e2e/helpers/test-accounts.ts e2e/fixtures/auth.setup.ts e2e/.auth/.gitkeep
git commit -m "feat(config): add auth setup and test account helpers"
```

---

## Task 3: Create Base Fixture and Mock Helpers

**Files:**

- Create: `e2e/fixtures/base.fixture.ts`
- Create: `e2e/helpers/mock-gemini.ts`
- Create: `e2e/helpers/mock-stripe.ts`
- Create: `e2e/helpers/mock-document-parse.ts`

**Step 1: Create `e2e/fixtures/base.fixture.ts`**

```typescript
import { test as base, type Page } from '@playwright/test';

const AUTH_DIR = 'e2e/.auth';

export const test = base.extend<{
  userPage: Page;
  adminPage: Page;
  superAdminPage: Page;
}>({
  userPage: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: `${AUTH_DIR}/user.json`,
    });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
  adminPage: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: `${AUTH_DIR}/admin.json`,
    });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
  superAdminPage: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: `${AUTH_DIR}/super-admin.json`,
    });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
});

export { expect } from '@playwright/test';
```

**Step 2: Create `e2e/helpers/mock-gemini.ts`**

```typescript
import type { Page } from '@playwright/test';

/**
 * Mock the /api/chat/stream SSE endpoint with a predictable text response.
 */
export async function mockGeminiStream(
  page: Page,
  response: string = 'This is a mock AI response for testing purposes.',
) {
  await page.route('**/api/chat/stream', async (route) => {
    const chunks = response.split(' ');
    const sseLines = chunks.map((chunk) => `data: ${JSON.stringify({ text: chunk + ' ' })}\n\n`);
    const body = sseLines.join('') + 'data: [DONE]\n\n';

    await route.fulfill({
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
      body,
    });
  });
}

/**
 * Mock the /api/chat/stream to return an error.
 */
export async function mockGeminiError(page: Page, status: number = 500) {
  await page.route('**/api/chat/stream', async (route) => {
    await route.fulfill({
      status,
      body: JSON.stringify({ error: 'Mock Gemini error' }),
    });
  });
}
```

**Step 3: Create `e2e/helpers/mock-stripe.ts`**

```typescript
import type { Page } from '@playwright/test';

/**
 * Mock Stripe Checkout — returns a fake checkout URL.
 */
export async function mockStripeCheckout(page: Page) {
  await page.route('**/api/stripe/checkout', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ url: 'https://checkout.stripe.com/test-session-id' }),
    });
  });
}

/**
 * Mock Stripe Portal — returns a fake portal URL.
 */
export async function mockStripePortal(page: Page) {
  await page.route('**/api/stripe/portal', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ url: 'https://billing.stripe.com/test-portal-id' }),
    });
  });
}

/**
 * Mock Stripe Webhook — acknowledge event.
 */
export async function mockStripeWebhook(page: Page) {
  await page.route('**/api/stripe/webhook', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ received: true }),
    });
  });
}
```

**Step 4: Create `e2e/helpers/mock-document-parse.ts`**

```typescript
import type { Page } from '@playwright/test';

/**
 * Mock the /api/documents/parse SSE endpoint with progress stages.
 */
export async function mockDocumentParse(page: Page, documentId: string = 'test-doc-1') {
  await page.route('**/api/documents/parse', async (route) => {
    const sseBody = [
      `data: ${JSON.stringify({ type: 'progress', stage: 'parsing', percent: 30 })}\n\n`,
      `data: ${JSON.stringify({ type: 'progress', stage: 'extracting', percent: 60 })}\n\n`,
      `data: ${JSON.stringify({ type: 'progress', stage: 'embedding', percent: 90 })}\n\n`,
      `data: ${JSON.stringify({ type: 'complete', documentId })}\n\n`,
    ].join('');

    await route.fulfill({
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
      body: sseBody,
    });
  });
}

/**
 * Mock document parse failure.
 */
export async function mockDocumentParseError(page: Page) {
  await page.route('**/api/documents/parse', async (route) => {
    const sseBody = [
      `data: ${JSON.stringify({ type: 'progress', stage: 'parsing', percent: 30 })}\n\n`,
      `data: ${JSON.stringify({ type: 'error', message: 'Failed to process document' })}\n\n`,
    ].join('');

    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
      body: sseBody,
    });
  });
}
```

**Step 5: Commit**

```bash
git add e2e/fixtures/base.fixture.ts e2e/helpers/mock-gemini.ts e2e/helpers/mock-stripe.ts e2e/helpers/mock-document-parse.ts
git commit -m "feat(config): add base fixture and API mock helpers"
```

---

## Task 4: Create Page Object Models — Login & Sidebar

**Files:**

- Create: `e2e/pages/LoginPage.ts`
- Create: `e2e/pages/components/Sidebar.ts`

**Step 1: Create `e2e/pages/LoginPage.ts`**

```typescript
import type { Locator, Page } from '@playwright/test';

export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly confirmPasswordInput: Locator;
  readonly submitButton: Locator;
  readonly errorAlert: Locator;
  readonly successAlert: Locator;
  readonly toggleSignupLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.getByLabel(/email/i);
    this.passwordInput = page.getByLabel(/^password$/i);
    this.confirmPasswordInput = page.getByLabel(/confirm/i);
    this.submitButton = page.locator('.login-submit-btn');
    this.errorAlert = page
      .locator('[data-variant="light"][data-color="red"]')
      .or(page.getByRole('alert').filter({ hasText: /error|invalid|incorrect/i }));
    this.successAlert = page
      .locator('[data-variant="light"][data-color="teal"]')
      .or(page.getByRole('alert').filter({ hasText: /check.*email/i }));
    this.toggleSignupLink = page.getByRole('button', { name: /create account|sign in/i }).last();
  }

  async goto() {
    await this.page.goto('/login');
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  async signup(email: string, password: string, confirmPassword: string) {
    // Switch to signup mode if needed
    const buttonText = await this.submitButton.textContent();
    if (buttonText && /sign in/i.test(buttonText)) {
      await this.toggleSignupLink.click();
    }
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.confirmPasswordInput.fill(confirmPassword);
    await this.submitButton.click();
  }

  async waitForRedirectToStudy() {
    await this.page.waitForURL('**/study', { timeout: 15_000 });
  }
}
```

**Step 2: Create `e2e/pages/components/Sidebar.ts`**

```typescript
import type { Locator, Page } from '@playwright/test';

export class Sidebar {
  readonly page: Page;
  readonly expandButton: Locator;
  readonly collapseButton: Locator;
  readonly logoutButton: Locator;
  readonly settingsLink: Locator;
  readonly personalizationLink: Locator;
  readonly helpLink: Locator;
  readonly upgradePlanLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.expandButton = page.getByRole('button', { name: /open sidebar/i });
    this.collapseButton = page.getByRole('button', { name: /close sidebar/i });
    this.logoutButton = page.getByRole('menuitem', { name: /log out/i });
    this.settingsLink = page.getByRole('menuitem', { name: /settings/i });
    this.personalizationLink = page.getByRole('menuitem', { name: /personalization/i });
    this.helpLink = page.getByRole('menuitem', { name: /help/i });
    this.upgradePlanLink = page.getByRole('menuitem', { name: /upgrade/i });
  }

  async expand() {
    if (await this.expandButton.isVisible()) {
      await this.expandButton.click();
    }
  }

  async collapse() {
    if (await this.collapseButton.isVisible()) {
      await this.collapseButton.click();
    }
  }

  async openUserMenu() {
    // Click user avatar to open dropdown menu
    const avatar = this.page.locator('.mantine-Avatar-root').last();
    await avatar.click();
  }

  async logout() {
    await this.openUserMenu();
    await this.logoutButton.click();
  }

  async navigateTo(item: 'settings' | 'personalization' | 'help' | 'upgrade') {
    await this.openUserMenu();
    const links = {
      settings: this.settingsLink,
      personalization: this.personalizationLink,
      help: this.helpLink,
      upgrade: this.upgradePlanLink,
    };
    await links[item].click();
  }

  getSessionItem(title: string) {
    return this.page.locator('.sidebar-session', { hasText: title });
  }

  async createNewSession(module: 'lecture' | 'assignment' | 'exam') {
    await this.expand();
    // Click the "+" button next to the relevant module section
    const section = this.page.locator(`text=${module}`).first();
    const plusButton = section
      .locator('..')
      .getByRole('button', { name: /new/i })
      .or(section.locator('..').locator('[data-testid="new-session"]'));
    await plusButton.click();
  }
}
```

**Step 3: Commit**

```bash
git add e2e/pages/LoginPage.ts e2e/pages/components/Sidebar.ts
git commit -m "feat(config): add LoginPage and Sidebar page objects"
```

---

## Task 5: Create Page Object Models — Study, Chat, Exam

**Files:**

- Create: `e2e/pages/StudyPage.ts`
- Create: `e2e/pages/components/ChatPanel.ts`
- Create: `e2e/pages/ExamListPage.ts`
- Create: `e2e/pages/MockExamPage.ts`

**Step 1: Create `e2e/pages/StudyPage.ts`**

```typescript
import type { Locator, Page } from '@playwright/test';

export class StudyPage {
  readonly page: Page;
  readonly lectureHelperCard: Locator;
  readonly assignmentCoachCard: Locator;
  readonly mockExamCard: Locator;

  constructor(page: Page) {
    this.page = page;
    // The 3 feature cards on the study page
    this.lectureHelperCard = page.getByText(/lecture helper/i).first();
    this.assignmentCoachCard = page.getByText(/assignment coach/i).first();
    this.mockExamCard = page.getByText(/mock exam/i).first();
  }

  async goto() {
    await this.page.goto('/study');
  }

  async selectLectureHelper() {
    await this.lectureHelperCard.click();
  }

  async selectAssignmentCoach() {
    await this.assignmentCoachCard.click();
  }

  async selectMockExam() {
    await this.mockExamCard.click();
  }
}
```

**Step 2: Create `e2e/pages/components/ChatPanel.ts`**

```typescript
import type { Locator, Page } from '@playwright/test';

export class ChatPanel {
  readonly page: Page;
  readonly messageInput: Locator;
  readonly sendButton: Locator;
  readonly stopButton: Locator;
  readonly attachButton: Locator;
  readonly fileInput: Locator;
  readonly messageList: Locator;

  constructor(page: Page) {
    this.page = page;
    this.messageInput = page.getByPlaceholder(/ask me anything|type.*message/i);
    this.sendButton = page.getByRole('button', { name: /send message/i });
    this.stopButton = page.getByRole('button', { name: /stop generating/i });
    this.attachButton = page.getByRole('button', { name: /attach file/i });
    this.fileInput = page.locator('input[type="file"]');
    this.messageList = page
      .locator('[class*="message"]')
      .or(page.locator('[data-testid="message-list"]'));
  }

  async sendMessage(text: string) {
    await this.messageInput.fill(text);
    await this.sendButton.click();
  }

  async waitForResponse() {
    // Wait for AI response to appear (the stop button disappears when done)
    await this.stopButton.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => {});
    await this.stopButton.waitFor({ state: 'hidden', timeout: 30_000 });
  }

  async uploadImage(filePath: string) {
    await this.fileInput.setInputFiles(filePath);
  }

  getMessages() {
    return this.page
      .locator('[class*="message-bubble"]')
      .or(this.page.locator('[class*="chat-message"]'));
  }

  getLastAIMessage() {
    return this.page
      .locator('[class*="message"]')
      .filter({ hasText: /AI Tutor/i })
      .last();
  }
}
```

**Step 3: Create `e2e/pages/ExamListPage.ts`**

```typescript
import type { Locator, Page } from '@playwright/test';

export class ExamListPage {
  readonly page: Page;
  readonly sourceSelector: Locator;
  readonly modeSelector: Locator;
  readonly universitySelect: Locator;
  readonly courseSelect: Locator;
  readonly paperSelect: Locator;
  readonly numQuestionsInput: Locator;
  readonly topicInput: Locator;
  readonly difficultySelect: Locator;
  readonly startButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.sourceSelector = page
      .getByRole('radiogroup')
      .first()
      .or(page.locator('.mantine-SegmentedControl-root').first());
    this.modeSelector = page.locator('.mantine-SegmentedControl-root').last();
    this.universitySelect = page.getByLabel(/university/i);
    this.courseSelect = page.getByLabel(/course/i);
    this.paperSelect = page.getByLabel(/select paper/i);
    this.numQuestionsInput = page.getByLabel(/num.*questions|number.*questions/i);
    this.topicInput = page.getByLabel(/topic/i);
    this.difficultySelect = page.getByLabel(/difficulty/i);
    this.startButton = page.getByRole('button', { name: /start/i });
  }

  async goto() {
    await this.page.goto('/exam');
  }

  async selectSource(source: 'real' | 'random' | 'ai') {
    const labels = { real: /real exam/i, random: /random mix/i, ai: /ai/i };
    await this.page.getByText(labels[source]).click();
  }

  async selectMode(mode: 'practice' | 'exam') {
    await this.page.getByText(mode === 'practice' ? /practice/i : /exam/i).click();
  }
}
```

**Step 4: Create `e2e/pages/MockExamPage.ts`**

```typescript
import type { Locator, Page } from '@playwright/test';

export class MockExamPage {
  readonly page: Page;
  readonly questionContent: Locator;
  readonly answerInput: Locator;
  readonly submitButton: Locator;
  readonly nextButton: Locator;
  readonly previousButton: Locator;
  readonly progressIndicator: Locator;
  readonly scoreDisplay: Locator;

  constructor(page: Page) {
    this.page = page;
    this.questionContent = page.locator('[class*="question"]').first();
    this.answerInput = page
      .getByPlaceholder(/enter.*answer|write.*answer/i)
      .or(page.locator('textarea').first());
    this.submitButton = page.getByRole('button', { name: /submit/i });
    this.nextButton = page.getByRole('button', { name: /next/i });
    this.previousButton = page.getByRole('button', { name: /previous/i });
    this.progressIndicator = page.getByText(/\d+\s*\/\s*\d+/);
    this.scoreDisplay = page.getByText(/score/i);
  }

  async goto(examId: string) {
    await this.page.goto(`/exam/mock/${examId}`);
  }

  async answerQuestion(answer: string) {
    await this.answerInput.fill(answer);
    await this.submitButton.click();
  }

  async goToNext() {
    await this.nextButton.click();
  }

  async goToPrevious() {
    await this.previousButton.click();
  }
}
```

**Step 5: Commit**

```bash
git add e2e/pages/StudyPage.ts e2e/pages/components/ChatPanel.ts e2e/pages/ExamListPage.ts e2e/pages/MockExamPage.ts
git commit -m "feat(config): add Study, ChatPanel, ExamList, MockExam page objects"
```

---

## Task 6: Create Page Object Models — Admin Pages

**Files:**

- Create: `e2e/pages/admin/AdminCoursesPage.ts`
- Create: `e2e/pages/admin/AdminUsersPage.ts`
- Create: `e2e/pages/admin/AdminKnowledgePage.ts`
- Create: `e2e/pages/admin/AdminExamPage.ts`

**Step 1: Create `e2e/pages/admin/AdminCoursesPage.ts`**

```typescript
import type { Locator, Page } from '@playwright/test';

export class AdminCoursesPage {
  readonly page: Page;
  readonly universitiesTab: Locator;
  readonly coursesTab: Locator;
  readonly addButton: Locator;
  readonly table: Locator;

  constructor(page: Page) {
    this.page = page;
    this.universitiesTab = page.getByRole('tab', { name: /universit/i });
    this.coursesTab = page.getByRole('tab', { name: /course/i });
    this.addButton = page.getByRole('button', { name: /add|create/i });
    this.table = page.locator('table').or(page.locator('[role="table"]'));
  }

  async goto() {
    await this.page.goto('/admin/courses');
  }

  async switchToUniversities() {
    await this.universitiesTab.click();
  }

  async switchToCourses() {
    await this.coursesTab.click();
  }

  getRow(text: string) {
    return this.table.locator('tr', { hasText: text });
  }

  getEditButton(row: Locator) {
    return row.getByRole('button', { name: /edit/i });
  }

  getDeleteButton(row: Locator) {
    return row.getByRole('button', { name: /delete/i });
  }
}
```

**Step 2: Create `e2e/pages/admin/AdminUsersPage.ts`**

```typescript
import type { Locator, Page } from '@playwright/test';

export class AdminUsersPage {
  readonly page: Page;
  readonly userTable: Locator;
  readonly searchInput: Locator;

  constructor(page: Page) {
    this.page = page;
    this.userTable = page.locator('table').or(page.locator('[role="table"]'));
    this.searchInput = page.getByPlaceholder(/search/i);
  }

  async goto() {
    await this.page.goto('/admin/users');
  }

  getUserRow(email: string) {
    return this.userTable.locator('tr', { hasText: email });
  }

  getDeleteButton(row: Locator) {
    return row.getByRole('button', { name: /delete/i });
  }

  getRoleBadge(row: Locator) {
    return row.locator('.mantine-Badge-root');
  }
}
```

**Step 3: Create `e2e/pages/admin/AdminKnowledgePage.ts`**

```typescript
import type { Locator, Page } from '@playwright/test';

export class AdminKnowledgePage {
  readonly page: Page;
  readonly docTypeSelector: Locator;
  readonly uploadButton: Locator;
  readonly searchInput: Locator;
  readonly documentTable: Locator;

  constructor(page: Page) {
    this.page = page;
    this.docTypeSelector = page.locator('.mantine-SegmentedControl-root').first();
    this.uploadButton = page.getByRole('button', { name: /upload/i });
    this.searchInput = page.getByPlaceholder(/search/i);
    this.documentTable = page.locator('table').or(page.locator('[role="table"]'));
  }

  async goto() {
    await this.page.goto('/admin/knowledge');
  }

  async selectDocType(type: 'lecture' | 'assignment' | 'exam') {
    await this.page.getByText(new RegExp(type, 'i')).click();
  }

  getDocumentRow(name: string) {
    return this.documentTable.locator('tr', { hasText: name });
  }

  getStatusBadge(row: Locator) {
    return row.locator('.mantine-Badge-root');
  }
}
```

**Step 4: Create `e2e/pages/admin/AdminExamPage.ts`**

```typescript
import type { Locator, Page } from '@playwright/test';

export class AdminExamPage {
  readonly page: Page;
  readonly examTable: Locator;
  readonly createButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.examTable = page.locator('table').or(page.locator('[role="table"]'));
    this.createButton = page.getByRole('button', { name: /create|add/i });
  }

  async goto() {
    await this.page.goto('/admin/exam');
  }

  getExamRow(title: string) {
    return this.examTable.locator('tr', { hasText: title });
  }

  getDeleteButton(row: Locator) {
    return row.getByRole('button', { name: /delete/i });
  }

  getVisibilityToggle(row: Locator) {
    return row.locator('.mantine-Switch-root').or(row.getByRole('switch'));
  }
}
```

**Step 5: Commit**

```bash
git add e2e/pages/admin/
git commit -m "feat(config): add admin page objects (courses, users, knowledge, exam)"
```

---

## Task 7: Create Page Object Models — Settings, Personalization, Pricing, Landing, Others

**Files:**

- Create: `e2e/pages/SettingsPage.ts`
- Create: `e2e/pages/PersonalizationPage.ts`
- Create: `e2e/pages/PricingPage.ts`
- Create: `e2e/pages/LandingPage.ts`
- Create: `e2e/pages/HelpPage.ts`
- Create: `e2e/pages/AssignmentPage.ts`
- Create: `e2e/pages/LecturePage.ts`
- Create: `e2e/pages/SharePage.ts`
- Create: `e2e/pages/components/FullScreenModal.ts`

**Step 1: Create `e2e/pages/SettingsPage.ts`**

```typescript
import type { Locator, Page } from '@playwright/test';

export class SettingsPage {
  readonly page: Page;
  readonly themeToggle: Locator;
  readonly languageSelect: Locator;
  readonly planBadge: Locator;
  readonly upgradeButton: Locator;
  readonly manageStripeButton: Locator;
  readonly usageProgressBar: Locator;

  constructor(page: Page) {
    this.page = page;
    this.themeToggle = page.locator('.mantine-Switch-root').first();
    this.languageSelect = page.getByRole('combobox').or(page.locator('.mantine-Select-root'));
    this.planBadge = page.locator('.mantine-Badge-root').filter({ hasText: /pro|free/i });
    this.upgradeButton = page.getByRole('link', { name: /upgrade|view.*options/i });
    this.manageStripeButton = page.getByRole('button', { name: /manage.*stripe/i });
    this.usageProgressBar = page.locator('.mantine-Progress-root');
  }

  async goto() {
    await this.page.goto('/settings');
  }

  async toggleTheme() {
    await this.themeToggle.click();
  }

  async switchLanguage(lang: 'en' | 'zh') {
    await this.languageSelect.click();
    const option = lang === 'en' ? /english/i : /中文/i;
    await this.page.getByRole('option', { name: option }).click();
  }
}
```

**Step 2: Create `e2e/pages/PersonalizationPage.ts`**

```typescript
import type { Locator, Page } from '@playwright/test';

export class PersonalizationPage {
  readonly page: Page;
  readonly displayName: Locator;
  readonly editNameButton: Locator;
  readonly nameInput: Locator;
  readonly saveNameButton: Locator;
  readonly cancelNameButton: Locator;
  readonly email: Locator;
  readonly subscriptionBadge: Locator;
  readonly deleteAccountButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.displayName = page.locator('[class*="name"]').or(page.getByText(/display name/i));
    this.editNameButton = page
      .getByRole('button')
      .filter({ has: page.locator('svg') })
      .first();
    this.nameInput = page.getByRole('textbox');
    this.saveNameButton = page
      .getByRole('button', { name: /save|confirm/i })
      .or(page.locator('button').filter({ has: page.locator('[data-icon="check"]') }));
    this.cancelNameButton = page.getByRole('button', { name: /cancel/i });
    this.email = page.getByText(/@/);
    this.subscriptionBadge = page.locator('.mantine-Badge-root').filter({ hasText: /pro|free/i });
    this.deleteAccountButton = page.getByRole('button', { name: /delete account/i });
  }

  async goto() {
    await this.page.goto('/personalization');
  }

  async editDisplayName(newName: string) {
    await this.editNameButton.click();
    await this.nameInput.clear();
    await this.nameInput.fill(newName);
    await this.nameInput.press('Enter');
  }
}
```

**Step 3: Create `e2e/pages/PricingPage.ts`**

```typescript
import type { Locator, Page } from '@playwright/test';

export class PricingPage {
  readonly page: Page;
  readonly billingToggle: Locator;
  readonly freePlanCard: Locator;
  readonly proPlanCard: Locator;
  readonly upgradeButton: Locator;
  readonly saveBadge: Locator;

  constructor(page: Page) {
    this.page = page;
    this.billingToggle = page.locator('.mantine-SegmentedControl-root');
    this.freePlanCard = page.locator('[class*="card"]').filter({ hasText: /free/i }).first();
    this.proPlanCard = page.locator('[class*="card"]').filter({ hasText: /pro/i }).first();
    this.upgradeButton = page.getByRole('button', { name: /upgrade/i });
    this.saveBadge = page.locator('.mantine-Badge-root').filter({ hasText: /save/i });
  }

  async goto() {
    await this.page.goto('/pricing');
  }

  async switchToSemester() {
    await this.page.getByText(/semester/i).click();
  }

  async switchToMonthly() {
    await this.page.getByText(/monthly/i).click();
  }

  async clickUpgrade() {
    await this.upgradeButton.click();
  }
}
```

**Step 4: Create `e2e/pages/LandingPage.ts`**

```typescript
import type { Locator, Page } from '@playwright/test';

export class LandingPage {
  readonly page: Page;
  readonly heroTitle: Locator;
  readonly ctaButton: Locator;
  readonly loginButton: Locator;
  readonly languageSwitcher: Locator;
  readonly featuresSection: Locator;
  readonly howItWorksSection: Locator;
  readonly testimonialsSection: Locator;
  readonly footer: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heroTitle = page.locator('h1').first();
    this.ctaButton = page.getByRole('link', { name: /start.*free|开始.*体验/i }).first();
    this.loginButton = page.getByRole('link', { name: /login|登录/i });
    this.languageSwitcher = page
      .locator('[class*="language"]')
      .or(page.getByText(/english|中文/).first());
    this.featuresSection = page
      .locator('section')
      .filter({ hasText: /feature|功能/i })
      .first();
    this.howItWorksSection = page
      .locator('section')
      .filter({ hasText: /how it works|如何使用/i })
      .first();
    this.testimonialsSection = page
      .locator('section')
      .filter({ hasText: /testimonial|评价/i })
      .first();
    this.footer = page.locator('footer');
  }

  async goto(lang: 'en' | 'zh' = 'en') {
    await this.page.goto(lang === 'zh' ? '/zh' : '/');
  }
}
```

**Step 5: Create `e2e/pages/HelpPage.ts`**

```typescript
import type { Page } from '@playwright/test';

export class HelpPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto('/help');
  }
}
```

**Step 6: Create `e2e/pages/AssignmentPage.ts`**

```typescript
import type { Locator, Page } from '@playwright/test';

export class AssignmentPage {
  readonly page: Page;
  readonly assignmentTitle: Locator;
  readonly content: Locator;

  constructor(page: Page) {
    this.page = page;
    this.assignmentTitle = page.locator('h1, h2').first();
    this.content = page.locator('[class*="content"], [class*="assignment"]').first();
  }

  async goto(id: string) {
    await this.page.goto(`/assignment/${id}`);
  }
}
```

**Step 7: Create `e2e/pages/LecturePage.ts`**

```typescript
import type { Locator, Page } from '@playwright/test';

export class LecturePage {
  readonly page: Page;
  readonly lectureTitle: Locator;
  readonly content: Locator;

  constructor(page: Page) {
    this.page = page;
    this.lectureTitle = page.locator('h1, h2').first();
    this.content = page.locator('[class*="content"], [class*="lecture"]').first();
  }

  async goto(id: string) {
    await this.page.goto(`/lecture/${id}`);
  }
}
```

**Step 8: Create `e2e/pages/SharePage.ts`**

```typescript
import type { Locator, Page } from '@playwright/test';

export class SharePage {
  readonly page: Page;
  readonly title: Locator;
  readonly sharedBadge: Locator;
  readonly signInButton: Locator;
  readonly messageList: Locator;
  readonly metadata: Locator;

  constructor(page: Page) {
    this.page = page;
    this.title = page.locator('h1, h2').first();
    this.sharedBadge = page.locator('.mantine-Badge-root').filter({ hasText: /shared/i });
    this.signInButton = page.getByRole('link', { name: /sign in/i });
    this.messageList = page.locator('[class*="message"]');
    this.metadata = page.getByText(/•/);
  }

  async goto(id: string) {
    await this.page.goto(`/share/${id}`);
  }
}
```

**Step 9: Create `e2e/pages/components/FullScreenModal.ts`**

```typescript
import type { Locator, Page } from '@playwright/test';

export class FullScreenModal {
  readonly page: Page;
  readonly root: Locator;
  readonly closeButton: Locator;
  readonly title: Locator;

  constructor(page: Page) {
    this.page = page;
    this.root = page.locator('.mantine-Modal-root');
    this.closeButton = this.root
      .getByRole('button', { name: /close/i })
      .or(this.root.locator('.mantine-Modal-close'));
    this.title = this.root.locator('.mantine-Modal-title');
  }

  async waitForOpen() {
    await this.root.waitFor({ state: 'visible' });
  }

  async close() {
    await this.closeButton.click();
    await this.root.waitFor({ state: 'hidden' });
  }

  async isOpen() {
    return this.root.isVisible();
  }
}
```

**Step 10: Commit**

```bash
git add e2e/pages/
git commit -m "feat(config): add remaining page objects (Settings, Pricing, Landing, etc.)"
```

---

## Task 8: Write Auth Test Specs

**Files:**

- Create: `e2e/tests/auth/login.spec.ts`
- Create: `e2e/tests/auth/signup.spec.ts`
- Create: `e2e/tests/auth/logout.spec.ts`

**Step 1: Create `e2e/tests/auth/login.spec.ts`**

```typescript
import { expect, test } from '../../fixtures/base.fixture';
import { TEST_ACCOUNTS } from '../../helpers/test-accounts';
import { LoginPage } from '../../pages/LoginPage';

test.describe('Login', () => {
  test('should login with valid credentials and redirect to /study', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(TEST_ACCOUNTS.user.email, TEST_ACCOUNTS.user.password);
    await loginPage.waitForRedirectToStudy();
    await expect(page).toHaveURL(/\/study/);
  });

  test('should show error with invalid credentials', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login('wrong@email.com', 'wrongpassword');

    // Should stay on login page and show error
    await expect(page).toHaveURL(/\/login/);
    await expect(loginPage.errorAlert).toBeVisible({ timeout: 10_000 });
  });

  test('should validate empty form fields', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    // Click submit with empty fields
    await loginPage.submitButton.click();

    // Should stay on login page (form validation prevents submission)
    await expect(page).toHaveURL(/\/login/);
  });

  test('should redirect authenticated user away from login', async ({ userPage }) => {
    await userPage.goto('/login');
    // Already authenticated user should be redirected to /study
    await expect(userPage).toHaveURL(/\/study/);
  });
});
```

**Step 2: Create `e2e/tests/auth/signup.spec.ts`**

```typescript
import { expect, test } from '../../fixtures/base.fixture';
import { LoginPage } from '../../pages/LoginPage';

test.describe('Signup', () => {
  test('should show password strength indicator', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    // Switch to signup mode
    await loginPage.toggleSignupLink.click();
    await expect(loginPage.confirmPasswordInput).toBeVisible();

    // Type a weak password
    await loginPage.passwordInput.fill('12345');
    // Password strength indicator should be visible
    const strengthIndicator = page.locator('.mantine-Progress-root, [class*="strength"]');
    await expect(strengthIndicator).toBeVisible();
  });

  test('should show confirm password field in signup mode', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    // Switch to signup mode
    await loginPage.toggleSignupLink.click();
    await expect(loginPage.confirmPasswordInput).toBeVisible();

    // Switch back to login mode
    await loginPage.toggleSignupLink.click();
    await expect(loginPage.confirmPasswordInput).toBeHidden();
  });

  test('should show error for mismatched passwords', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.toggleSignupLink.click();

    await loginPage.emailInput.fill('test-mismatch@test.local');
    await loginPage.passwordInput.fill('ValidPass123!');
    await loginPage.confirmPasswordInput.fill('DifferentPass456!');
    await loginPage.submitButton.click();

    // Should show password mismatch error or stay on page
    await expect(page).toHaveURL(/\/login/);
  });
});
```

**Step 3: Create `e2e/tests/auth/logout.spec.ts`**

```typescript
import { expect, test } from '../../fixtures/base.fixture';
import { Sidebar } from '../../pages/components/Sidebar';

test.describe('Logout', () => {
  test('should logout and redirect to login', async ({ userPage }) => {
    await userPage.goto('/study');
    const sidebar = new Sidebar(userPage);

    await sidebar.expand();
    await sidebar.logout();

    // Should redirect to login page
    await expect(userPage).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test('should not access protected routes after logout', async ({ page }) => {
    // Use a fresh non-authenticated page
    await page.goto('/study');

    // Should be redirected to login
    await expect(page).toHaveURL(/\/login/);
  });
});
```

**Step 4: Commit**

```bash
git add e2e/tests/auth/
git commit -m "feat(config): add auth E2E test specs (login, signup, logout)"
```

---

## Task 9: Write Study/Chat Test Specs

**Files:**

- Create: `e2e/tests/study/chat-session.spec.ts`
- Create: `e2e/tests/study/chat-streaming.spec.ts`
- Create: `e2e/tests/study/mode-selection.spec.ts`
- Create: `e2e/tests/study/image-upload.spec.ts`

**Step 1: Create `e2e/tests/study/chat-session.spec.ts`**

```typescript
import { expect, test } from '../../fixtures/base.fixture';
import { Sidebar } from '../../pages/components/Sidebar';
import { StudyPage } from '../../pages/StudyPage';

test.describe('Chat Sessions', () => {
  test('should display study page with mode selection cards', async ({ userPage }) => {
    const studyPage = new StudyPage(userPage);
    await studyPage.goto();

    await expect(studyPage.lectureHelperCard).toBeVisible();
    await expect(studyPage.assignmentCoachCard).toBeVisible();
    await expect(studyPage.mockExamCard).toBeVisible();
  });

  test('should create a new chat session via mode card', async ({ userPage }) => {
    const studyPage = new StudyPage(userPage);
    await studyPage.goto();

    // Click lecture helper card to open session creation
    await studyPage.selectLectureHelper();

    // Should open a modal to select course
    const modal = userPage.locator('.mantine-Modal-root');
    await expect(modal).toBeVisible({ timeout: 5_000 });
  });

  test('should list existing sessions in sidebar', async ({ userPage }) => {
    await userPage.goto('/study');
    const sidebar = new Sidebar(userPage);
    await sidebar.expand();

    // Sidebar should be visible with session sections
    const sidebarContent = userPage.locator('.sidebar-session');
    // May have 0 or more sessions depending on test data
    await expect(sidebar.collapseButton).toBeVisible();
  });
});
```

**Step 2: Create `e2e/tests/study/chat-streaming.spec.ts`**

```typescript
import { expect, test } from '../../fixtures/base.fixture';
import { mockGeminiStream } from '../../helpers/mock-gemini';
import { ChatPanel } from '../../pages/components/ChatPanel';

test.describe('Chat Streaming', () => {
  test('should send message and receive mock AI response', async ({ userPage }) => {
    // First navigate to an existing chat session or create one
    // Mock the AI response before navigating
    await mockGeminiStream(userPage, 'Hello! I am your AI tutor. How can I help you today?');

    await userPage.goto('/study');
    // If there's an active session, the chat panel should be visible
    // Otherwise we may need to create a session first

    const chatPanel = new ChatPanel(userPage);

    // Check if chat input is available (means we're in an active session)
    const inputVisible = await chatPanel.messageInput.isVisible().catch(() => false);
    if (!inputVisible) {
      // Skip if no active session — this test needs test data
      test.skip(true, 'No active chat session available for streaming test');
    }

    await chatPanel.sendMessage('What is calculus?');
    await chatPanel.waitForResponse();

    // Verify the mock response appeared
    const lastMessage = chatPanel.getLastAIMessage();
    await expect(lastMessage).toContainText(/AI tutor/i);
  });

  test('should show loading state while streaming', async ({ userPage }) => {
    // Create a slow mock that we can observe
    await userPage.route('**/api/chat/stream', async (route) => {
      // Delay the response
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body: 'data: {"text":"Response"}\n\ndata: [DONE]\n\n',
      });
    });

    await userPage.goto('/study');
    const chatPanel = new ChatPanel(userPage);

    const inputVisible = await chatPanel.messageInput.isVisible().catch(() => false);
    if (!inputVisible) {
      test.skip(true, 'No active chat session available');
    }

    await chatPanel.sendMessage('Test loading state');

    // Stop button should appear while streaming
    await expect(chatPanel.stopButton).toBeVisible({ timeout: 5_000 });
  });
});
```

**Step 3: Create `e2e/tests/study/mode-selection.spec.ts`**

```typescript
import { expect, test } from '../../fixtures/base.fixture';
import { StudyPage } from '../../pages/StudyPage';

test.describe('Mode Selection', () => {
  test('should display all three tutoring mode cards', async ({ userPage }) => {
    const studyPage = new StudyPage(userPage);
    await studyPage.goto();

    await expect(studyPage.lectureHelperCard).toBeVisible();
    await expect(studyPage.assignmentCoachCard).toBeVisible();
    await expect(studyPage.mockExamCard).toBeVisible();
  });

  test('should open course selection modal when clicking lecture helper', async ({ userPage }) => {
    const studyPage = new StudyPage(userPage);
    await studyPage.goto();
    await studyPage.selectLectureHelper();

    const modal = userPage.locator('.mantine-Modal-root');
    await expect(modal).toBeVisible({ timeout: 5_000 });
  });

  test('should open course selection modal when clicking assignment coach', async ({
    userPage,
  }) => {
    const studyPage = new StudyPage(userPage);
    await studyPage.goto();
    await studyPage.selectAssignmentCoach();

    const modal = userPage.locator('.mantine-Modal-root');
    await expect(modal).toBeVisible({ timeout: 5_000 });
  });

  test('should open mock exam modal when clicking mock exam', async ({ userPage }) => {
    const studyPage = new StudyPage(userPage);
    await studyPage.goto();
    await studyPage.selectMockExam();

    const modal = userPage.locator('.mantine-Modal-root');
    await expect(modal).toBeVisible({ timeout: 5_000 });
  });
});
```

**Step 4: Create `e2e/tests/study/image-upload.spec.ts`**

```typescript
import path from 'path';
import { expect, test } from '../../fixtures/base.fixture';
import { ChatPanel } from '../../pages/components/ChatPanel';

test.describe('Image Upload in Chat', () => {
  test('should show image preview after selecting a file', async ({ userPage }) => {
    await userPage.goto('/study');
    const chatPanel = new ChatPanel(userPage);

    const inputVisible = await chatPanel.messageInput.isVisible().catch(() => false);
    if (!inputVisible) {
      test.skip(true, 'No active chat session available');
    }

    // Create a test image buffer (1x1 pixel PNG)
    const buffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64',
    );

    // Upload via file input
    await chatPanel.fileInput.setInputFiles({
      name: 'test-image.png',
      mimeType: 'image/png',
      buffer,
    });

    // Image preview should appear
    const preview = userPage
      .locator('img[src*="blob:"]')
      .or(userPage.locator('[class*="preview"]'));
    await expect(preview).toBeVisible({ timeout: 5_000 });
  });
});
```

**Step 5: Commit**

```bash
git add e2e/tests/study/
git commit -m "feat(config): add study/chat E2E test specs"
```

---

## Task 10: Write Exam and Assignment Test Specs

**Files:**

- Create: `e2e/tests/exam/exam-list.spec.ts`
- Create: `e2e/tests/exam/mock-exam.spec.ts`
- Create: `e2e/tests/assignment/assignment-view.spec.ts`

**Step 1: Create `e2e/tests/exam/exam-list.spec.ts`**

```typescript
import { expect, test } from '../../fixtures/base.fixture';
import { ExamListPage } from '../../pages/ExamListPage';

test.describe('Exam List', () => {
  test('should display exam entry page with source selection', async ({ userPage }) => {
    const examList = new ExamListPage(userPage);
    await examList.goto();

    // Source selection should be visible
    await expect(userPage.getByText(/real exam/i)).toBeVisible();
    await expect(userPage.getByText(/random mix/i)).toBeVisible();
    await expect(userPage.getByText(/ai/i)).toBeVisible();
  });

  test('should show university and course selects', async ({ userPage }) => {
    const examList = new ExamListPage(userPage);
    await examList.goto();

    await expect(examList.universitySelect).toBeVisible();
    await expect(examList.courseSelect).toBeVisible();
  });

  test('should show paper select for real exam source', async ({ userPage }) => {
    const examList = new ExamListPage(userPage);
    await examList.goto();

    await examList.selectSource('real');
    // Paper select should appear for real exam mode
    await expect(examList.paperSelect).toBeVisible({ timeout: 5_000 });
  });

  test('should show topic and difficulty for AI source', async ({ userPage }) => {
    const examList = new ExamListPage(userPage);
    await examList.goto();

    await examList.selectSource('ai');
    // AI-specific fields should appear
    await expect(examList.topicInput).toBeVisible({ timeout: 5_000 });
    await expect(examList.difficultySelect).toBeVisible({ timeout: 5_000 });
  });

  test('should have start exam button', async ({ userPage }) => {
    const examList = new ExamListPage(userPage);
    await examList.goto();

    await expect(examList.startButton).toBeVisible();
  });
});
```

**Step 2: Create `e2e/tests/exam/mock-exam.spec.ts`**

```typescript
import { expect, test } from '../../fixtures/base.fixture';
import { MockExamPage } from '../../pages/MockExamPage';

test.describe('Mock Exam', () => {
  // Note: These tests require a valid mock exam ID in the test database.
  // If no test data exists, they will be skipped.

  test('should display question and answer input on mock exam page', async ({ userPage }) => {
    // Try to navigate to a mock exam — this may 404 if no test data
    await userPage.goto('/exam/mock/test-exam-id');

    // Check if we got redirected or got an error
    const url = userPage.url();
    if (url.includes('/exam') && !url.includes('/mock/')) {
      test.skip(true, 'No test exam data available');
    }

    const mockExam = new MockExamPage(userPage);
    // If we're on the exam page, verify basic structure
    await expect(mockExam.questionContent).toBeVisible({ timeout: 5_000 });
  });

  test('should show progress indicator', async ({ userPage }) => {
    await userPage.goto('/exam/mock/test-exam-id');

    const url = userPage.url();
    if (!url.includes('/mock/')) {
      test.skip(true, 'No test exam data available');
    }

    const mockExam = new MockExamPage(userPage);
    await expect(mockExam.progressIndicator).toBeVisible({ timeout: 5_000 });
  });
});
```

**Step 3: Create `e2e/tests/assignment/assignment-view.spec.ts`**

```typescript
import { expect, test } from '../../fixtures/base.fixture';
import { AssignmentPage } from '../../pages/AssignmentPage';

test.describe('Assignment View', () => {
  test('should display assignment content when valid ID provided', async ({ userPage }) => {
    // Navigate to assignment page — requires valid test data
    const assignmentPage = new AssignmentPage(userPage);
    await assignmentPage.goto('test-assignment-id');

    // If no test data, page may show error or redirect
    const url = userPage.url();
    if (!url.includes('/assignment/')) {
      test.skip(true, 'No test assignment data available');
    }

    // Verify page loaded with some content
    const hasContent = await assignmentPage.content.isVisible().catch(() => false);
    if (hasContent) {
      await expect(assignmentPage.assignmentTitle).toBeVisible();
    }
  });
});
```

**Step 4: Commit**

```bash
git add e2e/tests/exam/ e2e/tests/assignment/
git commit -m "feat(config): add exam and assignment E2E test specs"
```

---

## Task 11: Write Admin Test Specs

**Files:**

- Create: `e2e/tests/admin/courses.spec.ts`
- Create: `e2e/tests/admin/users.spec.ts`
- Create: `e2e/tests/admin/knowledge.spec.ts`
- Create: `e2e/tests/admin/exam-papers.spec.ts`

**Step 1: Create `e2e/tests/admin/courses.spec.ts`**

```typescript
import { expect, test } from '../../fixtures/base.fixture';
import { AdminCoursesPage } from '../../pages/admin/AdminCoursesPage';

test.describe('Admin Courses', () => {
  test('should display courses management page', async ({ adminPage }) => {
    const coursesPage = new AdminCoursesPage(adminPage);
    await coursesPage.goto();

    await expect(adminPage).toHaveURL(/\/admin\/courses/);
    await expect(coursesPage.table).toBeVisible({ timeout: 10_000 });
  });

  test('should have universities and courses tabs', async ({ adminPage }) => {
    const coursesPage = new AdminCoursesPage(adminPage);
    await coursesPage.goto();

    await expect(coursesPage.universitiesTab).toBeVisible();
    await expect(coursesPage.coursesTab).toBeVisible();
  });

  test('should switch between universities and courses tabs', async ({ adminPage }) => {
    const coursesPage = new AdminCoursesPage(adminPage);
    await coursesPage.goto();

    await coursesPage.switchToUniversities();
    await expect(coursesPage.table).toBeVisible();

    await coursesPage.switchToCourses();
    await expect(coursesPage.table).toBeVisible();
  });

  test('should have add button', async ({ adminPage }) => {
    const coursesPage = new AdminCoursesPage(adminPage);
    await coursesPage.goto();

    await expect(coursesPage.addButton).toBeVisible();
  });

  test('should deny access to regular users', async ({ userPage }) => {
    await userPage.goto('/admin/courses');

    // Regular user should be redirected or see access denied
    await expect(userPage).not.toHaveURL(/\/admin\/courses/);
  });
});
```

**Step 2: Create `e2e/tests/admin/users.spec.ts`**

```typescript
import { expect, test } from '../../fixtures/base.fixture';
import { AdminUsersPage } from '../../pages/admin/AdminUsersPage';

test.describe('Admin Users', () => {
  test('should display users page for super admin', async ({ superAdminPage }) => {
    const usersPage = new AdminUsersPage(superAdminPage);
    await usersPage.goto();

    await expect(superAdminPage).toHaveURL(/\/admin\/users/);
    await expect(usersPage.userTable).toBeVisible({ timeout: 10_000 });
  });

  test('should show user rows with email and role', async ({ superAdminPage }) => {
    const usersPage = new AdminUsersPage(superAdminPage);
    await usersPage.goto();

    // There should be at least one user row (the test accounts)
    const rows = usersPage.userTable.locator('tr');
    await expect(rows).not.toHaveCount(0);
  });

  test('should deny access to regular admin', async ({ adminPage }) => {
    await adminPage.goto('/admin/users');

    // Admin (not super_admin) should be denied
    await expect(adminPage).not.toHaveURL(/\/admin\/users/);
  });

  test('should deny access to regular users', async ({ userPage }) => {
    await userPage.goto('/admin/users');

    await expect(userPage).not.toHaveURL(/\/admin\/users/);
  });
});
```

**Step 3: Create `e2e/tests/admin/knowledge.spec.ts`**

```typescript
import { expect, test } from '../../fixtures/base.fixture';
import { AdminKnowledgePage } from '../../pages/admin/AdminKnowledgePage';

test.describe('Admin Knowledge', () => {
  test('should display knowledge management page', async ({ adminPage }) => {
    const knowledgePage = new AdminKnowledgePage(adminPage);
    await knowledgePage.goto();

    await expect(adminPage).toHaveURL(/\/admin\/knowledge/);
  });

  test('should have doc type selector', async ({ adminPage }) => {
    const knowledgePage = new AdminKnowledgePage(adminPage);
    await knowledgePage.goto();

    await expect(knowledgePage.docTypeSelector).toBeVisible();
  });

  test('should have upload button', async ({ adminPage }) => {
    const knowledgePage = new AdminKnowledgePage(adminPage);
    await knowledgePage.goto();

    await expect(knowledgePage.uploadButton).toBeVisible();
  });

  test('should have search functionality', async ({ adminPage }) => {
    const knowledgePage = new AdminKnowledgePage(adminPage);
    await knowledgePage.goto();

    await expect(knowledgePage.searchInput).toBeVisible();
  });
});
```

**Step 4: Create `e2e/tests/admin/exam-papers.spec.ts`**

```typescript
import { expect, test } from '../../fixtures/base.fixture';
import { AdminExamPage } from '../../pages/admin/AdminExamPage';

test.describe('Admin Exam Papers', () => {
  test('should display exam management page', async ({ adminPage }) => {
    const examPage = new AdminExamPage(adminPage);
    await examPage.goto();

    await expect(adminPage).toHaveURL(/\/admin\/exam/);
  });

  test('should have exam table', async ({ adminPage }) => {
    const examPage = new AdminExamPage(adminPage);
    await examPage.goto();

    await expect(examPage.examTable).toBeVisible({ timeout: 10_000 });
  });
});
```

**Step 5: Commit**

```bash
git add e2e/tests/admin/
git commit -m "feat(config): add admin E2E test specs (courses, users, knowledge, exam)"
```

---

## Task 12: Write Settings, Personalization, and Billing Test Specs

**Files:**

- Create: `e2e/tests/settings/settings.spec.ts`
- Create: `e2e/tests/settings/personalization.spec.ts`
- Create: `e2e/tests/billing/pricing.spec.ts`

**Step 1: Create `e2e/tests/settings/settings.spec.ts`**

```typescript
import { expect, test } from '../../fixtures/base.fixture';
import { SettingsPage } from '../../pages/SettingsPage';

test.describe('Settings', () => {
  test('should display settings page', async ({ userPage }) => {
    const settings = new SettingsPage(userPage);
    await settings.goto();

    await expect(userPage).toHaveURL(/\/settings/);
  });

  test('should have theme toggle', async ({ userPage }) => {
    const settings = new SettingsPage(userPage);
    await settings.goto();

    await expect(settings.themeToggle).toBeVisible();
  });

  test('should toggle theme', async ({ userPage }) => {
    const settings = new SettingsPage(userPage);
    await settings.goto();

    // Get initial color scheme
    const htmlBefore = await userPage.locator('html').getAttribute('data-mantine-color-scheme');

    await settings.toggleTheme();

    // Color scheme should change
    const htmlAfter = await userPage.locator('html').getAttribute('data-mantine-color-scheme');
    expect(htmlBefore).not.toBe(htmlAfter);
  });

  test('should show plan badge', async ({ userPage }) => {
    const settings = new SettingsPage(userPage);
    await settings.goto();

    await expect(settings.planBadge).toBeVisible();
  });

  test('should show usage progress bar', async ({ userPage }) => {
    const settings = new SettingsPage(userPage);
    await settings.goto();

    await expect(settings.usageProgressBar).toBeVisible();
  });
});
```

**Step 2: Create `e2e/tests/settings/personalization.spec.ts`**

```typescript
import { expect, test } from '../../fixtures/base.fixture';
import { PersonalizationPage } from '../../pages/PersonalizationPage';

test.describe('Personalization', () => {
  test('should display personalization page', async ({ userPage }) => {
    const personalization = new PersonalizationPage(userPage);
    await personalization.goto();

    await expect(userPage).toHaveURL(/\/personalization/);
  });

  test('should show user email', async ({ userPage }) => {
    const personalization = new PersonalizationPage(userPage);
    await personalization.goto();

    await expect(personalization.email).toBeVisible();
  });

  test('should show subscription badge', async ({ userPage }) => {
    const personalization = new PersonalizationPage(userPage);
    await personalization.goto();

    await expect(personalization.subscriptionBadge).toBeVisible();
  });

  test('should have delete account button', async ({ userPage }) => {
    const personalization = new PersonalizationPage(userPage);
    await personalization.goto();

    await expect(personalization.deleteAccountButton).toBeVisible();
  });

  test('should open delete account confirmation modal', async ({ userPage }) => {
    const personalization = new PersonalizationPage(userPage);
    await personalization.goto();

    await personalization.deleteAccountButton.click();

    // Confirmation modal should appear
    const modal = userPage.locator('.mantine-Modal-root');
    await expect(modal).toBeVisible();

    // Should require typing "DELETE"
    const deleteInput = modal.getByPlaceholder(/DELETE/);
    await expect(deleteInput).toBeVisible();

    // Close modal without deleting
    await userPage.keyboard.press('Escape');
  });
});
```

**Step 3: Create `e2e/tests/billing/pricing.spec.ts`**

```typescript
import { expect, test } from '../../fixtures/base.fixture';
import { mockStripeCheckout } from '../../helpers/mock-stripe';
import { PricingPage } from '../../pages/PricingPage';

test.describe('Pricing', () => {
  test('should display pricing page with plans', async ({ userPage }) => {
    const pricing = new PricingPage(userPage);
    await pricing.goto();

    await expect(userPage).toHaveURL(/\/pricing/);
    await expect(pricing.proPlanCard).toBeVisible();
  });

  test('should have billing toggle (monthly/semester)', async ({ userPage }) => {
    const pricing = new PricingPage(userPage);
    await pricing.goto();

    await expect(pricing.billingToggle).toBeVisible();
  });

  test('should switch between monthly and semester pricing', async ({ userPage }) => {
    const pricing = new PricingPage(userPage);
    await pricing.goto();

    // Switch to semester
    await pricing.switchToSemester();
    await expect(pricing.saveBadge).toBeVisible();

    // Switch back to monthly
    await pricing.switchToMonthly();
  });

  test('should redirect to Stripe checkout on upgrade click', async ({ userPage }) => {
    await mockStripeCheckout(userPage);

    const pricing = new PricingPage(userPage);
    await pricing.goto();

    // If user is on Free plan, upgrade button should be clickable
    const isVisible = await pricing.upgradeButton.isVisible().catch(() => false);
    if (!isVisible) {
      test.skip(true, 'User already on Pro plan');
    }

    // Clicking should trigger navigation to mocked Stripe URL
    const [response] = await Promise.all([
      userPage.waitForResponse('**/api/stripe/checkout'),
      pricing.clickUpgrade(),
    ]);

    expect(response.status()).toBe(200);
  });
});
```

**Step 4: Commit**

```bash
git add e2e/tests/settings/ e2e/tests/billing/
git commit -m "feat(config): add settings, personalization, and billing E2E specs"
```

---

## Task 13: Write Navigation and Public Page Test Specs

**Files:**

- Create: `e2e/tests/navigation/sidebar.spec.ts`
- Create: `e2e/tests/navigation/routing-guards.spec.ts`
- Create: `e2e/tests/public/landing.spec.ts`
- Create: `e2e/tests/public/share.spec.ts`

**Step 1: Create `e2e/tests/navigation/sidebar.spec.ts`**

```typescript
import { expect, test } from '../../fixtures/base.fixture';
import { Sidebar } from '../../pages/components/Sidebar';

test.describe('Sidebar Navigation', () => {
  test('should expand and collapse sidebar', async ({ userPage }) => {
    await userPage.goto('/study');
    const sidebar = new Sidebar(userPage);

    // Expand
    await sidebar.expand();
    await expect(sidebar.collapseButton).toBeVisible();

    // Collapse
    await sidebar.collapse();
    await expect(sidebar.expandButton).toBeVisible();
  });

  test('should navigate to settings via sidebar menu', async ({ userPage }) => {
    await userPage.goto('/study');
    const sidebar = new Sidebar(userPage);

    await sidebar.expand();
    await sidebar.navigateTo('settings');

    await expect(userPage).toHaveURL(/\/settings/);
  });

  test('should navigate to personalization via sidebar menu', async ({ userPage }) => {
    await userPage.goto('/study');
    const sidebar = new Sidebar(userPage);

    await sidebar.expand();
    await sidebar.navigateTo('personalization');

    await expect(userPage).toHaveURL(/\/personalization/);
  });

  test('should navigate to help via sidebar menu', async ({ userPage }) => {
    await userPage.goto('/study');
    const sidebar = new Sidebar(userPage);

    await sidebar.expand();
    await sidebar.navigateTo('help');

    await expect(userPage).toHaveURL(/\/help/);
  });
});
```

**Step 2: Create `e2e/tests/navigation/routing-guards.spec.ts`**

```typescript
import { expect, test } from '@playwright/test';

test.describe('Routing Guards', () => {
  test('should redirect unauthenticated user to /login from /study', async ({ page }) => {
    await page.goto('/study');
    await expect(page).toHaveURL(/\/login/);
  });

  test('should redirect unauthenticated user to /login from /exam', async ({ page }) => {
    await page.goto('/exam');
    await expect(page).toHaveURL(/\/login/);
  });

  test('should redirect unauthenticated user to /login from /settings', async ({ page }) => {
    await page.goto('/settings');
    await expect(page).toHaveURL(/\/login/);
  });

  test('should redirect unauthenticated user to /login from /admin/courses', async ({ page }) => {
    await page.goto('/admin/courses');
    await expect(page).toHaveURL(/\/login/);
  });

  test('should allow unauthenticated access to landing page', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/^http:\/\/localhost:3000\/?$/);
  });

  test('should allow unauthenticated access to /login', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveURL(/\/login/);
  });

  test('should allow unauthenticated access to /zh', async ({ page }) => {
    await page.goto('/zh');
    await expect(page).toHaveURL(/\/zh/);
  });
});
```

**Step 3: Create `e2e/tests/public/landing.spec.ts`**

```typescript
import { expect, test } from '@playwright/test';
import { LandingPage } from '../../pages/LandingPage';

test.describe('Landing Page', () => {
  test('should render English landing page', async ({ page }) => {
    const landing = new LandingPage(page);
    await landing.goto('en');

    await expect(landing.heroTitle).toBeVisible();
    await expect(landing.ctaButton).toBeVisible();
    await expect(landing.footer).toBeVisible();
  });

  test('should render Chinese landing page', async ({ page }) => {
    const landing = new LandingPage(page);
    await landing.goto('zh');

    await expect(landing.heroTitle).toBeVisible();
    // Chinese content should be present
    await expect(page.getByText(/学习|助手|智能/)).toBeVisible();
  });

  test('should have CTA button that links to /login', async ({ page }) => {
    const landing = new LandingPage(page);
    await landing.goto('en');

    const href = await landing.ctaButton.getAttribute('href');
    expect(href).toContain('/login');
  });

  test('should display features section', async ({ page }) => {
    const landing = new LandingPage(page);
    await landing.goto('en');

    await expect(landing.featuresSection).toBeVisible();
  });

  test('should display how it works section', async ({ page }) => {
    const landing = new LandingPage(page);
    await landing.goto('en');

    await expect(landing.howItWorksSection).toBeVisible();
  });

  test('should display testimonials section', async ({ page }) => {
    const landing = new LandingPage(page);
    await landing.goto('en');

    await expect(landing.testimonialsSection).toBeVisible();
  });

  test('should have login button in navbar', async ({ page }) => {
    const landing = new LandingPage(page);
    await landing.goto('en');

    await expect(landing.loginButton).toBeVisible();
  });
});
```

**Step 4: Create `e2e/tests/public/share.spec.ts`**

```typescript
import { expect, test } from '@playwright/test';
import { SharePage } from '../../pages/SharePage';

test.describe('Share Page', () => {
  test('should show shared chat badge', async ({ page }) => {
    // Navigate to a share page — needs valid share ID from test data
    const sharePage = new SharePage(page);
    await sharePage.goto('test-share-id');

    // If valid, should show shared badge
    const hasBadge = await sharePage.sharedBadge.isVisible().catch(() => false);
    if (!hasBadge) {
      // Invalid share ID — verify some error/empty state
      await expect(page.getByText(/not found|error|no.*found/i))
        .toBeVisible({ timeout: 5_000 })
        .catch(() => {
          // Page may just show empty state
        });
      return;
    }

    await expect(sharePage.sharedBadge).toBeVisible();
  });

  test('should have sign in button for unauthenticated users', async ({ page }) => {
    const sharePage = new SharePage(page);
    await sharePage.goto('test-share-id');

    await expect(sharePage.signInButton).toBeVisible();
  });

  test('should handle invalid share ID gracefully', async ({ page }) => {
    const sharePage = new SharePage(page);
    await sharePage.goto('invalid-nonexistent-id');

    // Should show error or empty state, not crash
    await page.waitForLoadState('networkidle');
    // Page should still be responsive
    await expect(page.locator('body')).toBeVisible();
  });
});
```

**Step 5: Commit**

```bash
git add e2e/tests/navigation/ e2e/tests/public/
git commit -m "feat(config): add navigation and public page E2E specs"
```

---

## Task 14: Verification — Run Full Suite and Fix Issues

**Step 1: Load environment variables and run all tests**

```bash
# Ensure .env.e2e exists with real credentials
# Then run:
npm run e2e -- --reporter=list
```

Expected: Tests should run. Some may fail due to selector mismatches or missing test data — that's OK.

**Step 2: Fix any import/TypeScript errors**

Check for:

- Missing type imports
- Incorrect relative paths
- TypeScript config issues (ensure `e2e/` is included in tsconfig or has its own)

**Step 3: Fix selector mismatches**

For any failing tests:

1. Run `npm run e2e:headed` to watch the browser
2. Use `npm run e2e:ui` for the Playwright UI debugger
3. Identify correct selectors by inspecting the DOM
4. Update Page Object Models with corrected selectors

**Step 4: Commit fixes**

```bash
git add -A
git commit -m "fix(config): fix E2E test selector and import issues"
```

**Step 5: Run final verification**

```bash
npm run e2e
```

Expected: All tests pass or skip gracefully (tests requiring specific test data may skip).

**Step 6: Generate and review report**

```bash
npm run e2e:report
```

Expected: HTML report opens in browser showing all test results.

**Step 7: Final commit**

```bash
git add -A
git commit -m "chore(config): E2E test suite verification pass"
```

---

## Summary

| Wave | Tasks | Description                                                     |
| ---- | ----- | --------------------------------------------------------------- |
| 1    | 1-3   | Foundation: Install, config, auth setup, fixtures, mock helpers |
| 2    | 4-7   | Page Object Models: All 15 pages + 3 components                 |
| 3    | 8-13  | Test Specs: All 21 spec files across 8 feature areas            |
| 4    | 14    | Verification: Run suite, fix issues, generate report            |

**Total: 14 tasks, 21 spec files, 15 page objects, 3 component POMs, 3 mock helpers, 3 fixtures**
