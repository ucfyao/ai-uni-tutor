import { Globe } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@mantine/core';
import { useLanguage } from '@/i18n/LanguageContext';

const LanguageSwitcher = () => {
  const { language } = useLanguage();

  return (
    <Button
      variant="subtle"
      size="sm"
      component={Link}
      href={language === 'zh' ? '/' : '/zh'}
      leftSection={<Globe className="w-4 h-4" />}
      px="xs"
    >
      {language === 'zh' ? 'EN' : '中文'}
    </Button>
  );
};

export default LanguageSwitcher;
