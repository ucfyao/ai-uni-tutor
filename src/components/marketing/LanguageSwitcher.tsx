import { Globe } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/i18n/LanguageContext';

const LanguageSwitcher = () => {
  const { language } = useLanguage();

  return (
    <Button variant="ghost" size="sm" asChild className="flex items-center gap-1.5 px-3">
      <Link href={language === 'zh' ? '/' : '/zh'}>
        <Globe className="w-4 h-4" />
        <span className="text-sm font-medium">{language === 'zh' ? 'EN' : '中文'}</span>
      </Link>
    </Button>
  );
};

export default LanguageSwitcher;
