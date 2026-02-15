# Pages Optimization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Optimize Settings, Personalization, Help, and Pricing pages — swap content between Settings/Personalization, enrich Help with categorized FAQs + contact support, redesign Pricing for course-based purchasing + partner program entry.

**Architecture:** Content swap between Settings and Personalization (Profile → Personalization, Theme/Language/Notifications → Settings). Help gets categorized FAQ sections. Pricing gets a flexible course-card layout with partner program CTA. All pages continue using `PageShell` shared layout with `Paper withBorder radius="lg" p="xl"` card pattern.

**Tech Stack:** Next.js App Router, React 19, Mantine v8, lucide-react icons, i18n via `useLanguage()` hook

---

### Task 1: Add i18n translation keys for all four pages

**Files:**

- Modify: `src/i18n/translations.ts`

This task adds all new translation keys needed by the four pages. Must be done first since all pages depend on these translations.

**Step 1: Add settings page translations to both `zh` and `en` sections**

Add a `settings` key after the `pricing` block in both language objects:

```typescript
// In zh object, after pricing block:
settings: {
  title: '设置',
  subtitle: '管理你的偏好和账户设置',
  preferences: '偏好设置',
  theme: '主题',
  themeDesc: '切换深色模式',
  language: '语言',
  languageDesc: 'AI 回复的首选语言',
  notifications: '通知',
  notificationsDesc: '接收邮件通知',
  planBilling: '套餐与账单',
  planBillingDesc: '当前订阅的详细概览',
  plusMember: 'Plus 会员',
  freeTier: '免费版',
  subscriptionActive: '订阅已激活',
  subscriptionActiveDesc: '你的 Plus 订阅已激活。你可以使用所有高级功能，包括无限文档上传和优先 AI 处理。',
  nextInvoice: '下次付款日：',
  manageViaStripe: '通过 Stripe 管理',
  freeTierLabel: '免费版',
  freeTierDesc: '你当前使用的是免费版。',
  freeTierUpgrade: '升级到 Pro 以解锁无限上传、高级 RAG 功能和优先支持。',
  viewUpgradeOptions: '查看升级选项',
  usageLimits: '用量与限制',
  usageLimitsDesc: '当前用量',
  dailyLLMUsage: '每日 AI 用量',
  fileUploadSize: '文件上传大小',
  perFile: '每个文件',
  documentStorage: '文档存储',
  unlimited: '无限',
  limited: '有限（共享）',
  dataPrivacy: '数据与隐私',
  deleteAccount: '删除账户',
  deleteAccountDesc: '永久删除你的账户和所有数据。',
  profileUpdated: '已保存',
  profileUpdatedMsg: '资料更新成功',
},

// In en object, after pricing block:
settings: {
  title: 'Settings',
  subtitle: 'Manage your preferences and account settings',
  preferences: 'Preferences',
  theme: 'Theme',
  themeDesc: 'Toggle dark mode',
  language: 'Language',
  languageDesc: 'Preferred language for AI responses',
  notifications: 'Notifications',
  notificationsDesc: 'Receive email updates',
  planBilling: 'Plan & Billing',
  planBillingDesc: 'Detailed overview of your current subscription',
  plusMember: 'Plus Member',
  freeTier: 'Free Tier',
  subscriptionActive: 'Subscription Active',
  subscriptionActiveDesc: 'Your Plus subscription is currently active. You have full access to all premium features including unlimited document uploads and priority AI processing.',
  nextInvoice: 'Next invoice:',
  manageViaStripe: 'Manage via Stripe',
  freeTierLabel: 'Free Tier',
  freeTierDesc: 'You are currently on the free plan.',
  freeTierUpgrade: 'Upgrade to Pro to unlock unlimited uploads, advanced RAG features, and priority support.',
  viewUpgradeOptions: 'View Upgrade Options',
  usageLimits: 'Usage & Limits',
  usageLimitsDesc: 'Current usage',
  dailyLLMUsage: 'Daily LLM Usage',
  fileUploadSize: 'File Upload Size',
  perFile: 'per file',
  documentStorage: 'Document Storage',
  unlimited: 'Unlimited',
  limited: 'Limited (Shared)',
  dataPrivacy: 'Data & Privacy',
  deleteAccount: 'Delete Account',
  deleteAccountDesc: 'Permanently delete your account and all data.',
  profileUpdated: 'Saved',
  profileUpdatedMsg: 'Profile updated successfully',
},
```

**Step 2: Add personalization page translations**

```typescript
// In zh object:
personalization: {
  title: '个性化',
  subtitle: '管理你的个人信息',
  profileInfo: '个人信息',
  displayName: '显示名称',
  displayNameDesc: '此名称将显示在侧栏和聊天中',
  emailAddress: '邮箱地址',
  emailDesc: '你的邮箱地址无法更改。',
  saveChanges: '保存更改',
  partnerProgram: '合伙人计划',
  partnerDesc: '邀请好友注册，获得课程购买返佣。',
  comingSoon: '即将推出',
},

// In en object:
personalization: {
  title: 'Personalization',
  subtitle: 'Manage your personal information',
  profileInfo: 'Profile Information',
  displayName: 'Display Name',
  displayNameDesc: 'This name will be displayed in the sidebar and chat',
  emailAddress: 'Email Address',
  emailDesc: 'Your email address cannot be changed.',
  saveChanges: 'Save Changes',
  partnerProgram: 'Partner Program',
  partnerDesc: 'Invite friends to register and earn commission on their course purchases.',
  comingSoon: 'Coming Soon',
},
```

**Step 3: Add help page translations**

```typescript
// In zh object:
help: {
  title: '帮助',
  subtitle: '浏览常见问题以找到你需要的答案',
  gettingStarted: '快速上手',
  tutoringModes: '辅导模式',
  accountBilling: '账户与账单',
  technical: '技术问题',
  faq: {
    uploadQ: '如何上传课程资料？',
    uploadA: '你可以在聊天界面或侧栏的"知识库"中直接上传 PDF 文档（课程大纲、笔记等）。只需拖放文件或点击选择即可。',
    startChatQ: '如何开始与 AI 导师对话？',
    startChatA: '在侧栏中选择一个辅导模式（课程讲座、作业辅导或模拟考试），然后创建新会话。选择你的大学和课程后即可开始对话。',
    fileFormatsQ: '支持哪些文件格式？',
    fileFormatsA: '目前支持 PDF 格式。上传后 AI 会自动解析内容并建立知识库，以便在对话中提供更精准的解答。',
    modesQ: '不同的辅导模式有什么区别？',
    modesA: 'AI 导师提供三种模式："课程讲座"用于理解概念，"作业辅导"用于帮助完成作业，"模拟考试"用于备考练习。你可以根据需要随时切换。',
    switchModeQ: '如何切换辅导模式？',
    switchModeA: '在侧栏中点击不同的模块即可切换。每个模式都有独立的会话列表，你的对话历史会保留在各自的模式中。',
    examPrepQ: '哪种模式最适合考试准备？',
    examPrepA: '"模拟考试"模式专为备考设计。它可以基于你上传的课程材料生成练习题，并提供详细的答案解释和评分。',
    upgradeQ: '如何升级我的套餐？',
    upgradeA: '前往"设置"页面的"套餐与账单"部分，点击"查看升级选项"即可。付款通过 Stripe 安全处理。',
    manageSubQ: '如何管理我的订阅？',
    manageSubA: '在"设置"页面的"套餐与账单"部分，点击"通过 Stripe 管理"按钮，即可查看、修改或取消你的订阅。',
    dataPrivacyQ: '我的数据是如何处理的？',
    dataPrivacyA: '你的数据安全存储在受保护的服务器上。我们不会与第三方共享你的个人信息或学习数据。你可以随时在"设置"中删除你的账户和所有数据。',
    aiModelQ: '使用的是哪个 AI 模型？',
    aiModelA: '我们使用 Gemini 2.0 等先进模型来提供最佳的辅导体验。',
    usageLimitsQ: '使用限制是什么？',
    usageLimitsA: '免费用户每天有一定的 AI 对话次数限制。升级到 Plus 可以获得更高的使用额度和更多功能。具体限制可以在"设置"页面查看。',
    browsersQ: '支持哪些浏览器？',
    browsersA: '我们支持所有主流现代浏览器，包括 Chrome、Firefox、Safari 和 Edge。建议使用最新版本以获得最佳体验。',
  },
  contactTitle: '仍然需要帮助？',
  contactDesc: '找不到你需要的答案？联系我们的支持团队。',
  contactEmail: '发送邮件',
},

// In en object:
help: {
  title: 'Help',
  subtitle: 'Browse frequently asked questions to find the answers you need',
  gettingStarted: 'Getting Started',
  tutoringModes: 'Tutoring Modes',
  accountBilling: 'Account & Billing',
  technical: 'Technical',
  faq: {
    uploadQ: 'How do I upload course materials?',
    uploadA: 'You can upload PDF documents (syllabus, notes, etc.) directly in the chat interface or through the "Knowledge Base" section in the sidebar. Simply drag and drop your files or click to select them.',
    startChatQ: 'How do I start a conversation with the AI tutor?',
    startChatA: 'Select a tutoring mode from the sidebar (Lectures, Assignments, or Mock Exams), then create a new session. Choose your university and course to start chatting.',
    fileFormatsQ: 'What file formats are supported?',
    fileFormatsA: 'Currently we support PDF format. After uploading, the AI automatically parses the content and builds a knowledge base to provide more accurate answers during conversations.',
    modesQ: 'What are the different tutoring modes?',
    modesA: 'AI Tutor offers three modes: "Lecture Helper" for understanding concepts, "Assignment Coach" for help with tasks, and "Mock Exam" for exam preparation. You can switch between modes anytime.',
    switchModeQ: 'How do I switch between modes?',
    switchModeA: 'Click on different modules in the sidebar to switch. Each mode has its own session list, and your conversation history is preserved within each mode.',
    examPrepQ: 'Which mode is best for exam preparation?',
    examPrepA: '"Mock Exam" mode is designed specifically for test prep. It can generate practice questions based on your uploaded course materials and provides detailed answer explanations and scoring.',
    upgradeQ: 'How do I upgrade my plan?',
    upgradeA: 'Go to the "Plan & Billing" section in Settings and click "View Upgrade Options". Payment is processed securely through Stripe.',
    manageSubQ: 'How do I manage my subscription?',
    manageSubA: 'In the "Plan & Billing" section of Settings, click the "Manage via Stripe" button to view, modify, or cancel your subscription.',
    dataPrivacyQ: 'How is my data handled?',
    dataPrivacyA: 'Your data is securely stored on protected servers. We do not share your personal information or learning data with third parties. You can delete your account and all data at any time from Settings.',
    aiModelQ: 'Which AI model is used?',
    aiModelA: 'We utilize advanced models like Gemini 2.0 to provide the best possible tutoring experience.',
    usageLimitsQ: 'What are the usage limits?',
    usageLimitsA: 'Free users have a daily limit on AI conversations. Upgrading to Plus gives you higher usage limits and more features. You can view your specific limits in Settings.',
    browsersQ: 'Which browsers are supported?',
    browsersA: 'We support all major modern browsers including Chrome, Firefox, Safari, and Edge. We recommend using the latest version for the best experience.',
  },
  contactTitle: 'Still need help?',
  contactDesc: "Can't find what you're looking for? Reach out to our support team.",
  contactEmail: 'Send Email',
},
```

**Step 4: Replace pricing page translations**

Replace the existing `pricing` block in both languages:

```typescript
// In zh object, replace existing pricing:
pricing: {
  title: '定价',
  subtitle: '按课程购买，解锁完整的 AI 导师功能。',
  coursePricing: '课程定价',
  perCourse: '每门课程',
  comingSoon: '即将推出',
  courseFeatures: [
    '完整的 AI 导师对话',
    '课程专属知识库',
    '模拟考试与评分',
    '无限文档上传',
  ],
  getStarted: '即将推出',
  partnerSection: '合伙人计划',
  partnerDesc: '邀请好友注册，赚取课程购买返佣。',
  learnMore: '了解更多',
  securePayment: '通过 Stripe 安全支付。',
  errorTitle: '错误',
},

// In en object, replace existing pricing:
pricing: {
  title: 'Pricing',
  subtitle: 'Purchase by course and unlock the full AI Tutor experience.',
  coursePricing: 'Course Pricing',
  perCourse: 'per course',
  comingSoon: 'Coming Soon',
  courseFeatures: [
    'Full AI tutor conversations',
    'Course-specific knowledge base',
    'Mock exams with scoring',
    'Unlimited document uploads',
  ],
  getStarted: 'Coming Soon',
  partnerSection: 'Partner Program',
  partnerDesc: 'Invite friends to register and earn commission on course purchases.',
  learnMore: 'Learn More',
  securePayment: 'Secure payment via Stripe.',
  errorTitle: 'Error',
},
```

**Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 6: Commit**

```bash
git add src/i18n/translations.ts
git commit -m "feat(ui): add i18n translations for settings, personalization, help, pricing pages"
```

---

### Task 2: Rewrite Settings page with Preferences section

**Files:**

- Modify: `src/app/(protected)/settings/page.tsx`
- Modify: `src/app/(protected)/settings/loading.tsx`

**Step 1: Rewrite settings page**

Replace the entire content of `src/app/(protected)/settings/page.tsx` with the following. Key changes:

- Remove Profile section (moved to Personalization)
- Add Preferences section with Theme, Language, Notifications (from Personalization)
- Use i18n translations for all text
- Clean row layout without Avatar icon decorations

```tsx
'use client';

import { CreditCard, Crown, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Container,
  Divider,
  Group,
  Paper,
  Progress,
  Select,
  Skeleton,
  Stack,
  Switch,
  Text,
  ThemeIcon,
  Title,
  useComputedColorScheme,
  useMantineColorScheme,
} from '@mantine/core';
import { PageShell } from '@/components/PageShell';
import { useProfile } from '@/context/ProfileContext';
import { useLanguage } from '@/i18n/LanguageContext';
import type { AccessLimits } from '@/lib/services/QuotaService';

export default function SettingsPage() {
  const { profile, loading: profileLoading } = useProfile();
  const { t } = useLanguage();
  const { setColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme('light', { getInitialValueInEffect: true });
  const [limits, setLimits] = useState<AccessLimits | null>(null);
  const [usage, setUsage] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLimits() {
      try {
        const res = await fetch('/api/quota');
        if (!res.ok) throw new Error('Failed to fetch quota information');
        const data: { status: { usage: number }; limits: AccessLimits } = await res.json();
        setLimits(data.limits);
        setUsage(data.status.usage);
      } catch (e) {
        console.error('Failed to fetch access limits', e);
      } finally {
        setLoading(false);
      }
    }
    fetchLimits();
  }, []);

  if (loading || profileLoading) {
    return (
      <Container size={700} py={60}>
        <Stack gap={40}>
          <Box>
            <Skeleton h={28} w={200} mb="xs" />
            <Skeleton h={16} w={350} />
          </Box>
          <Skeleton h={180} radius="lg" />
          <Skeleton h={280} radius="lg" />
          <Skeleton h={200} radius="lg" />
          <Skeleton h={80} radius="lg" />
        </Stack>
      </Container>
    );
  }

  const isPro =
    profile?.subscription_status === 'active' || profile?.subscription_status === 'trialing';

  return (
    <PageShell title={t.settings.title} subtitle={t.settings.subtitle}>
      {/* Preferences */}
      <Paper withBorder p="xl" radius="lg">
        <Stack gap="md">
          <Title order={3} fw={700}>
            {t.settings.preferences}
          </Title>

          <Group justify="space-between">
            <Box>
              <Text fw={500}>{t.settings.theme}</Text>
              <Text size="sm" c="dimmed">
                {t.settings.themeDesc}
              </Text>
            </Box>
            <Switch
              size="md"
              checked={computedColorScheme === 'dark'}
              onChange={() => setColorScheme(computedColorScheme === 'light' ? 'dark' : 'light')}
            />
          </Group>

          <Divider />

          <Group justify="space-between">
            <Box>
              <Text fw={500}>{t.settings.language}</Text>
              <Text size="sm" c="dimmed">
                {t.settings.languageDesc}
              </Text>
            </Box>
            <Select
              w={140}
              defaultValue="en"
              data={[
                { value: 'en', label: 'English' },
                { value: 'zh', label: '中文' },
              ]}
            />
          </Group>

          <Divider />

          <Group justify="space-between">
            <Box>
              <Text fw={500}>{t.settings.notifications}</Text>
              <Text size="sm" c="dimmed">
                {t.settings.notificationsDesc}
              </Text>
            </Box>
            <Switch defaultChecked size="md" />
          </Group>
        </Stack>
      </Paper>

      {/* Plan & Billing */}
      <Paper
        withBorder
        p={0}
        radius="lg"
        style={{ overflow: 'hidden', border: '1px solid var(--mantine-color-gray-2)' }}
      >
        <Box p="xl">
          <Group justify="space-between" mb="xs">
            <Stack gap={4}>
              <Title order={3} fw={700}>
                {t.settings.planBilling}
              </Title>
              <Text size="sm" c="dimmed">
                {t.settings.planBillingDesc}
              </Text>
            </Stack>
            {isPro ? (
              <Badge
                size="xl"
                variant="filled"
                color="violet"
                leftSection={<Crown size={14} />}
                h={32}
              >
                {t.settings.plusMember}
              </Badge>
            ) : (
              <Badge size="xl" variant="light" color="gray" h={32}>
                {t.settings.freeTier}
              </Badge>
            )}
          </Group>
        </Box>

        <Divider color="gray.1" />

        <Box p="xl">
          {isPro ? (
            <Stack gap="xl">
              <Group align="flex-start" gap="xl">
                <ThemeIcon color="green.1" c="green.7" variant="filled" size={54} radius="md">
                  <ShieldCheck size={32} />
                </ThemeIcon>
                <Box style={{ flex: 1 }}>
                  <Text fw={700} fz="xl" mb={4}>
                    {t.settings.subscriptionActive}
                  </Text>
                  <Text size="sm" c="dimmed" lh={1.6}>
                    {t.settings.subscriptionActiveDesc}
                  </Text>
                  <Text size="sm" fw={600} mt="md" c="dark.3">
                    {t.settings.nextInvoice}{' '}
                    {profile?.current_period_end
                      ? new Date(profile.current_period_end).toLocaleDateString(undefined, {
                          dateStyle: 'long',
                        })
                      : 'N/A'}
                  </Text>
                </Box>
              </Group>
              <Button
                variant="default"
                radius="md"
                size="md"
                w="fit-content"
                leftSection={<CreditCard size={18} />}
              >
                {t.settings.manageViaStripe}
              </Button>
            </Stack>
          ) : (
            <Paper withBorder p="xl" radius="md" bg="gray.0">
              <Stack gap="md">
                <Group>
                  <ThemeIcon size="lg" radius="md" variant="white" color="gray">
                    <CreditCard size={20} />
                  </ThemeIcon>
                  <Box>
                    <Text fw={600}>{t.settings.freeTierLabel}</Text>
                    <Text size="sm" c="dimmed">
                      {t.settings.freeTierDesc}
                    </Text>
                  </Box>
                </Group>
                <Text size="sm" c="dimmed">
                  {t.settings.freeTierUpgrade}
                </Text>
                <Button
                  variant="light"
                  color="violet"
                  radius="md"
                  onClick={() => (window.location.href = '/pricing')}
                >
                  {t.settings.viewUpgradeOptions}
                </Button>
              </Stack>
            </Paper>
          )}
        </Box>
      </Paper>

      {/* Usage & Limits */}
      <Paper withBorder p="xl" radius="lg">
        <Stack gap="md">
          <Title order={3} fw={700}>
            {t.settings.usageLimits}
          </Title>
          <Text size="sm" c="dimmed">
            {t.settings.usageLimitsDesc}
          </Text>

          <Stack>
            <Group justify="space-between" mb={5}>
              <Text fw={500}>{t.settings.dailyLLMUsage}</Text>
              <Text
                size="sm"
                c={
                  usage >= (isPro ? limits?.dailyLimitPro || 30 : limits?.dailyLimitFree || 3)
                    ? 'red'
                    : 'dimmed'
                }
              >
                {usage} / {isPro ? limits?.dailyLimitPro || 30 : limits?.dailyLimitFree || 3}
              </Text>
            </Group>
            <Progress
              value={
                (usage / (isPro ? limits?.dailyLimitPro || 30 : limits?.dailyLimitFree || 3)) * 100
              }
              color={
                usage >= (isPro ? limits?.dailyLimitPro || 30 : limits?.dailyLimitFree || 3)
                  ? 'red'
                  : usage >=
                      (isPro ? limits?.dailyLimitPro || 30 : limits?.dailyLimitFree || 3) * 0.7
                    ? 'yellow'
                    : 'indigo'
              }
              size="md"
              radius="xl"
              mb="sm"
              animated
            />

            <Divider />
            <Group justify="space-between">
              <Text fw={500}>{t.settings.fileUploadSize}</Text>
              <Badge variant="light" color="blue">
                {limits?.maxFileSizeMB || 5}MB {t.settings.perFile}
              </Badge>
            </Group>
            <Divider />
            <Group justify="space-between">
              <Text fw={500}>{t.settings.documentStorage}</Text>
              <Badge variant="light" color={isPro ? 'green' : 'gray'}>
                {isPro ? t.settings.unlimited : t.settings.limited}
              </Badge>
            </Group>
          </Stack>
        </Stack>
      </Paper>

      {/* Data & Privacy */}
      <Box>
        <Title order={3} fw={700} mb="md">
          {t.settings.dataPrivacy}
        </Title>
        <Paper
          withBorder
          p="xl"
          radius="lg"
          bg="red.0"
          style={{ borderColor: 'var(--mantine-color-red-2)' }}
        >
          <Group justify="space-between">
            <Box>
              <Text fw={600} c="red.7">
                {t.settings.deleteAccount}
              </Text>
              <Text size="sm" c="red.6">
                {t.settings.deleteAccountDesc}
              </Text>
            </Box>
            <Button color="red" variant="light">
              {t.settings.deleteAccount}
            </Button>
          </Group>
        </Paper>
      </Box>
    </PageShell>
  );
}
```

**Step 2: Update settings loading skeleton**

Update `src/app/(protected)/settings/loading.tsx` to match new structure (5 skeleton sections: header, preferences, billing, usage, privacy):

```tsx
import { Box, Container, Skeleton, Stack } from '@mantine/core';

export default function SettingsLoading() {
  return (
    <Container size={700} py={60}>
      <Stack gap={40}>
        <Box>
          <Skeleton h={28} w={200} mb="xs" />
          <Skeleton h={16} w={350} />
        </Box>
        <Skeleton h={180} radius="lg" />
        <Skeleton h={280} radius="lg" />
        <Skeleton h={200} radius="lg" />
        <Skeleton h={80} radius="lg" />
      </Stack>
    </Container>
  );
}
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/app/(protected)/settings/page.tsx src/app/(protected)/settings/loading.tsx
git commit -m "refactor(ui): settings page — add preferences section, remove profile, use i18n"
```

---

### Task 3: Rewrite Personalization page with Profile + Partner Program

**Files:**

- Modify: `src/app/(protected)/personalization/page.tsx`
- Modify: `src/app/(protected)/personalization/loading.tsx`

**Step 1: Rewrite personalization page**

Replace entire content of `src/app/(protected)/personalization/page.tsx`. Key changes:

- Add Profile inline editing (from Settings) — no more modal
- Remove Theme/Language/Notifications (moved to Settings)
- Add Partner Program "Coming Soon" placeholder
- Use i18n translations

```tsx
'use client';

import { Handshake } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Badge, Box, Button, Group, Paper, Stack, Text, TextInput, Title } from '@mantine/core';
import { PageShell } from '@/components/PageShell';
import { FULL_NAME_MAX_LENGTH } from '@/constants/profile';
import { useProfile } from '@/context/ProfileContext';
import { useLanguage } from '@/i18n/LanguageContext';
import { showNotification } from '@/lib/notifications';

export default function PersonalizationPage() {
  const { profile, loading, updateProfile } = useProfile();
  const { t } = useLanguage();
  const [fullName, setFullName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile?.full_name) {
      setFullName(profile.full_name);
    }
  }, [profile]);

  const handleSaveProfile = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      await updateProfile({ full_name: fullName });
      showNotification({
        title: t.settings.profileUpdated,
        message: t.settings.profileUpdatedMsg,
        color: 'green',
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      showNotification({
        title: t.common.error,
        message,
        color: 'red',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageShell title={t.personalization.title} subtitle={t.personalization.subtitle}>
      {/* Profile Information */}
      <Paper withBorder p="xl" radius="lg">
        <Stack gap="md">
          <Title order={3} fw={700}>
            {t.personalization.profileInfo}
          </Title>
          <Group align="flex-end">
            <TextInput
              label={t.personalization.displayName}
              description={`${t.personalization.displayNameDesc} (max ${FULL_NAME_MAX_LENGTH})`}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              maxLength={FULL_NAME_MAX_LENGTH}
              style={{ flex: 1 }}
              disabled={loading}
            />
            <Button onClick={handleSaveProfile} loading={saving} variant="filled" color="dark">
              {t.personalization.saveChanges}
            </Button>
          </Group>

          <TextInput
            label={t.personalization.emailAddress}
            value={profile?.email || ''}
            disabled
            description={t.personalization.emailDesc}
          />
        </Stack>
      </Paper>

      {/* Partner Program — Coming Soon */}
      <Paper withBorder p="xl" radius="lg">
        <Stack gap="md">
          <Group justify="space-between">
            <Group gap="sm">
              <Handshake size={22} color="var(--mantine-color-violet-6)" />
              <Title order={3} fw={700}>
                {t.personalization.partnerProgram}
              </Title>
            </Group>
            <Badge variant="light" color="gray" size="lg">
              {t.personalization.comingSoon}
            </Badge>
          </Group>
          <Text size="sm" c="dimmed">
            {t.personalization.partnerDesc}
          </Text>
        </Stack>
      </Paper>
    </PageShell>
  );
}
```

**Step 2: Update personalization loading skeleton**

Update `src/app/(protected)/personalization/loading.tsx` to match new structure (2 cards: profile + partner):

```tsx
import { Box, Container, Skeleton, Stack } from '@mantine/core';

export default function PersonalizationLoading() {
  return (
    <Container size={700} py={60}>
      <Stack gap={40}>
        <Box>
          <Skeleton h={28} w={200} mb="xs" />
          <Skeleton h={16} w={350} />
        </Box>
        <Skeleton h={200} radius="lg" />
        <Skeleton h={100} radius="lg" />
      </Stack>
    </Container>
  );
}
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/app/(protected)/personalization/page.tsx src/app/(protected)/personalization/loading.tsx
git commit -m "refactor(ui): personalization page — add profile section, partner placeholder, use i18n"
```

---

### Task 4: Rewrite Help page with categorized FAQ + Contact Support

**Files:**

- Modify: `src/app/(protected)/help/page.tsx`
- Modify: `src/app/(protected)/help/loading.tsx`

**Step 1: Rewrite help page**

Replace entire content of `src/app/(protected)/help/page.tsx`. Key changes:

- 4 FAQ categories as separate Paper cards with Accordion
- Contact Support section at bottom
- All text from i18n

```tsx
'use client';

import { BookOpen, Cpu, CreditCard, GraduationCap, Mail } from 'lucide-react';
import { Accordion, Group, Paper, Stack, Text, Title, UnstyledButton } from '@mantine/core';
import { PageShell } from '@/components/PageShell';
import { useLanguage } from '@/i18n/LanguageContext';

export default function HelpPage() {
  const { t } = useLanguage();

  const faqCategories = [
    {
      title: t.help.gettingStarted,
      icon: BookOpen,
      items: [
        { q: t.help.faq.uploadQ, a: t.help.faq.uploadA },
        { q: t.help.faq.startChatQ, a: t.help.faq.startChatA },
        { q: t.help.faq.fileFormatsQ, a: t.help.faq.fileFormatsA },
      ],
    },
    {
      title: t.help.tutoringModes,
      icon: GraduationCap,
      items: [
        { q: t.help.faq.modesQ, a: t.help.faq.modesA },
        { q: t.help.faq.switchModeQ, a: t.help.faq.switchModeA },
        { q: t.help.faq.examPrepQ, a: t.help.faq.examPrepA },
      ],
    },
    {
      title: t.help.accountBilling,
      icon: CreditCard,
      items: [
        { q: t.help.faq.upgradeQ, a: t.help.faq.upgradeA },
        { q: t.help.faq.manageSubQ, a: t.help.faq.manageSubA },
        { q: t.help.faq.dataPrivacyQ, a: t.help.faq.dataPrivacyA },
      ],
    },
    {
      title: t.help.technical,
      icon: Cpu,
      items: [
        { q: t.help.faq.aiModelQ, a: t.help.faq.aiModelA },
        { q: t.help.faq.usageLimitsQ, a: t.help.faq.usageLimitsA },
        { q: t.help.faq.browsersQ, a: t.help.faq.browsersA },
      ],
    },
  ];

  return (
    <PageShell title={t.help.title} subtitle={t.help.subtitle}>
      {faqCategories.map((category) => {
        const Icon = category.icon;
        return (
          <Paper key={category.title} withBorder p="xl" radius="lg">
            <Stack gap="md">
              <Group gap="sm">
                <Icon size={20} color="var(--mantine-color-gray-6)" />
                <Title order={4} fw={700}>
                  {category.title}
                </Title>
              </Group>
              <Accordion variant="separated" radius="md">
                {category.items.map((item, index) => (
                  <Accordion.Item key={index} value={`${category.title}-${index}`}>
                    <Accordion.Control>
                      <Text size="sm" fw={500}>
                        {item.q}
                      </Text>
                    </Accordion.Control>
                    <Accordion.Panel>
                      <Text size="sm" c="dimmed" lh={1.6}>
                        {item.a}
                      </Text>
                    </Accordion.Panel>
                  </Accordion.Item>
                ))}
              </Accordion>
            </Stack>
          </Paper>
        );
      })}

      {/* Contact Support */}
      <Paper withBorder p="xl" radius="lg">
        <Group justify="space-between" align="center">
          <Stack gap={4}>
            <Title order={4} fw={700}>
              {t.help.contactTitle}
            </Title>
            <Text size="sm" c="dimmed">
              {t.help.contactDesc}
            </Text>
          </Stack>
          <UnstyledButton
            component="a"
            href="mailto:support@aiunitutor.com"
            py={8}
            px={16}
            style={{
              borderRadius: 8,
              border: '1px solid var(--mantine-color-gray-3)',
            }}
          >
            <Group gap={8}>
              <Mail size={16} color="var(--mantine-color-gray-6)" />
              <Text size="sm" fw={500}>
                {t.help.contactEmail}
              </Text>
            </Group>
          </UnstyledButton>
        </Group>
      </Paper>
    </PageShell>
  );
}
```

**Step 2: Update help loading skeleton**

Update `src/app/(protected)/help/loading.tsx` to match new structure (4 FAQ category cards + 1 contact card):

```tsx
import { Box, Container, Skeleton, Stack } from '@mantine/core';

export default function HelpLoading() {
  return (
    <Container size={700} py={60}>
      <Stack gap={40}>
        <Box>
          <Skeleton h={28} w={200} mb="xs" />
          <Skeleton h={16} w={350} />
        </Box>
        <Skeleton h={200} radius="lg" />
        <Skeleton h={200} radius="lg" />
        <Skeleton h={200} radius="lg" />
        <Skeleton h={200} radius="lg" />
        <Skeleton h={80} radius="lg" />
      </Stack>
    </Container>
  );
}
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/app/(protected)/help/page.tsx src/app/(protected)/help/loading.tsx
git commit -m "feat(ui): help page — categorized FAQ sections with contact support"
```

---

### Task 5: Rewrite Pricing page with course-based layout + Partner entry

**Files:**

- Modify: `src/app/(protected)/pricing/page.tsx`
- Modify: `src/app/(protected)/pricing/loading.tsx`

**Step 1: Rewrite pricing page**

Replace entire content of `src/app/(protected)/pricing/page.tsx`. Key changes:

- Replace single Plus Plan card with course pricing card grid
- Placeholder cards with "Coming Soon" badge
- Partner Program entry section at bottom
- All text from i18n

```tsx
'use client';

import { Check, GraduationCap, Handshake } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  Badge,
  Box,
  Button,
  Group,
  List,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { PageShell } from '@/components/PageShell';
import { useLanguage } from '@/i18n/LanguageContext';

export default function PricingPage() {
  const { t } = useLanguage();
  const router = useRouter();

  const placeholderCourses = [
    { name: 'Course A', price: '--' },
    { name: 'Course B', price: '--' },
  ];

  return (
    <PageShell title={t.pricing.title} subtitle={t.pricing.subtitle}>
      {/* Course Pricing Cards */}
      <Box>
        <Title order={3} fw={700} mb="md">
          {t.pricing.coursePricing}
        </Title>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
          {placeholderCourses.map((course) => (
            <Paper key={course.name} withBorder p="xl" radius="lg">
              <Stack gap="lg">
                <Group justify="space-between" align="flex-start">
                  <Group gap="sm">
                    <ThemeIcon variant="light" color="violet" size="lg" radius="md">
                      <GraduationCap size={20} />
                    </ThemeIcon>
                    <Box>
                      <Text fw={700}>{course.name}</Text>
                      <Text size="xs" c="dimmed">
                        {t.pricing.perCourse}
                      </Text>
                    </Box>
                  </Group>
                  <Badge variant="light" color="gray" size="lg">
                    {t.pricing.comingSoon}
                  </Badge>
                </Group>

                <List
                  spacing="xs"
                  size="sm"
                  center
                  icon={
                    <ThemeIcon color="violet" size={20} radius="xl" variant="light">
                      <Check size={12} strokeWidth={3} />
                    </ThemeIcon>
                  }
                >
                  {t.pricing.courseFeatures.map((feature, index) => (
                    <List.Item key={index}>
                      <Text size="sm" c="dimmed">
                        {feature}
                      </Text>
                    </List.Item>
                  ))}
                </List>

                <Button fullWidth variant="light" color="gray" radius="md" disabled>
                  {t.pricing.getStarted}
                </Button>
              </Stack>
            </Paper>
          ))}
        </SimpleGrid>
      </Box>

      {/* Partner Program Entry */}
      <Paper withBorder p="xl" radius="lg">
        <Group justify="space-between" align="center">
          <Group gap="sm">
            <Handshake size={22} color="var(--mantine-color-violet-6)" />
            <Stack gap={4}>
              <Title order={4} fw={700}>
                {t.pricing.partnerSection}
              </Title>
              <Text size="sm" c="dimmed">
                {t.pricing.partnerDesc}
              </Text>
            </Stack>
          </Group>
          <Button
            variant="light"
            color="violet"
            radius="md"
            onClick={() => router.push('/personalization')}
          >
            {t.pricing.learnMore}
          </Button>
        </Group>
      </Paper>

      <Text size="xs" c="dimmed" ta="center">
        {t.pricing.securePayment}
      </Text>
    </PageShell>
  );
}
```

**Step 2: Update pricing loading skeleton**

Update `src/app/(protected)/pricing/loading.tsx` to match new structure:

```tsx
import { Box, Container, SimpleGrid, Skeleton, Stack } from '@mantine/core';

export default function PricingLoading() {
  return (
    <Container size={700} py={60}>
      <Stack gap={40}>
        <Box>
          <Skeleton h={28} w={200} mb="xs" />
          <Skeleton h={16} w={350} />
        </Box>
        <Box>
          <Skeleton h={24} w={160} mb="md" />
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
            <Skeleton h={280} radius="lg" />
            <Skeleton h={280} radius="lg" />
          </SimpleGrid>
        </Box>
        <Skeleton h={80} radius="lg" />
      </Stack>
    </Container>
  );
}
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/app/(protected)/pricing/page.tsx src/app/(protected)/pricing/loading.tsx
git commit -m "feat(ui): pricing page — course-based layout with partner program entry"
```

---

### Task 6: Final verification — build, lint, type check

**Files:** None (verification only)

**Step 1: Run TypeScript type check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 2: Run lint**

Run: `npm run lint`
Expected: No errors

**Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Run tests**

Run: `npx vitest run`
Expected: All tests pass

**Step 5: Commit any auto-fixes from lint**

If lint/prettier made auto-fixes, commit them:

```bash
git add -A
git commit -m "style(ui): auto-format from lint"
```
