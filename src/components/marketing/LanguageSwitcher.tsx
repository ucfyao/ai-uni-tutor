import { Globe } from 'lucide-react';
import Link from 'next/link';
import { ActionIcon, Tooltip } from '@mantine/core';
import { useLanguage } from '@/i18n/LanguageContext';

const LanguageSwitcher = () => {
  const { language, setLanguage } = useLanguage();
  const targetLang = language === 'zh' ? 'en' : 'zh';
  const targetHref = targetLang === 'zh' ? '/zh' : '/';

  return (
    <Tooltip label={language === 'zh' ? 'Switch to English' : '切换到中文'}>
      <ActionIcon
        variant="subtle"
        color="gray"
        size="lg"
        component={Link}
        href={targetHref}
        onClick={() => setLanguage(targetLang)}
      >
        <Globe size={18} />
      </ActionIcon>
    </Tooltip>
  );
};

export default LanguageSwitcher;
