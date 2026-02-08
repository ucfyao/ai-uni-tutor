import { Menu, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/i18n/LanguageContext';
import LanguageSwitcher from './LanguageSwitcher';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { t } = useLanguage();

  const navLinkClassName =
    'relative inline-flex cursor-pointer items-center text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background after:absolute after:left-0 after:-bottom-1 after:h-[2px] after:w-full after:origin-left after:scale-x-0 after:bg-gradient-to-r after:from-primary after:to-accent after:transition-transform hover:after:scale-x-100';

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
      <div className="container mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-10 h-10 flex items-center justify-center">
              <Image
                src="/assets/logo.png"
                alt="AI UniTutor"
                width={40}
                height={40}
                className="w-10 h-10 object-contain"
                priority
              />
            </div>
            <span className="font-display font-bold text-xl">AI UniTutor</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className={navLinkClassName}>
              {t.nav.features}
            </a>
            <a href="#how-it-works" className={navLinkClassName}>
              {t.nav.howItWorks}
            </a>
            <a href="#testimonials" className={navLinkClassName}>
              {t.nav.testimonials}
            </a>
            <a href="#pricing" className={navLinkClassName}>
              {t.nav.pricing}
            </a>
          </div>

          {/* CTA Buttons */}
          <div className="hidden md:flex items-center gap-2">
            <LanguageSwitcher />
            <Button variant="ghost" asChild>
              <Link href="/login">{t.nav.login}</Link>
            </Button>
            <Button variant="hero" size="default" asChild>
              <Link href="/login">{t.nav.freeTrial}</Link>
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button className="md:hidden p-2" onClick={() => setIsOpen(!isOpen)}>
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isOpen && (
          <div className="md:hidden py-4 border-t border-border/50">
            <div className="flex flex-col gap-4">
              <a href="#features" className={`${navLinkClassName} py-2`}>
                {t.nav.features}
              </a>
              <a href="#how-it-works" className={`${navLinkClassName} py-2`}>
                {t.nav.howItWorks}
              </a>
              <a href="#testimonials" className={`${navLinkClassName} py-2`}>
                {t.nav.testimonials}
              </a>
              <a href="#pricing" className={`${navLinkClassName} py-2`}>
                {t.nav.pricing}
              </a>
              <div className="flex flex-col gap-2 pt-4">
                <LanguageSwitcher />
                <Button variant="ghost" className="w-full" asChild>
                  <Link href="/login">{t.nav.login}</Link>
                </Button>
                <Button variant="hero" className="w-full" asChild>
                  <Link href="/login">{t.nav.freeTrial}</Link>
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
