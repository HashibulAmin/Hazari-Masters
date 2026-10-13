import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from '../context/LanguageContext';
import { SupportedLanguage } from '../i18n/types';
import { Globe, Check, ChevronDown } from 'lucide-react';

interface LanguageSelectorProps {
  compact?: boolean;
  className?: string;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  compact = false,
  className = '',
}) => {
  const { language, setLanguage, currentOption, supportedLanguages, t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (code: SupportedLanguage) => {
    setLanguage(code);
    setIsOpen(false);
  };

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      {/* Header Language Switch Icon Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 rounded-xl border transition shadow-sm ${
          isOpen
            ? 'bg-emerald-950/90 border-emerald-500 text-emerald-300 ring-2 ring-emerald-500/20'
            : 'bg-slate-800/80 hover:bg-slate-700/90 text-slate-200 border-slate-700 hover:border-slate-500'
        } ${compact ? 'p-2' : 'px-2.5 py-1.5 text-xs font-semibold'}`}
        aria-haspopup="true"
        aria-expanded={isOpen}
        title={t('select_language', 'Select Language / ভাষা / भाषा')}
      >
        <Globe className="w-4 h-4 text-emerald-400 shrink-0" />
        {!compact && (
          <>
            <span className="text-base leading-none mr-0.5">{currentOption.flag}</span>
            <span className="font-bold tracking-wide uppercase text-[11px] hidden sm:inline">
              {currentOption.code}
            </span>
            <ChevronDown
              className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${
                isOpen ? 'rotate-180 text-emerald-400' : ''
              }`}
            />
          </>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-slate-900 border border-emerald-500/30 shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-md">
          <div className="px-3 py-2 border-b border-slate-800/80 flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              {t('language', 'Language')}
            </span>
            <span className="text-[10px] text-emerald-400 font-mono">
              4 Languages
            </span>
          </div>

          <div className="py-1 space-y-0.5">
            {supportedLanguages.map((opt) => {
              const isSelected = opt.code === language;
              return (
                <button
                  key={opt.code}
                  type="button"
                  onClick={() => handleSelect(opt.code)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs font-semibold transition ${
                    isSelected
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-lg leading-none">{opt.flag}</span>
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-100">{opt.nativeName}</span>
                      <span className="text-[10px] text-slate-400 font-normal">{opt.name}</span>
                    </div>
                  </div>

                  {isSelected && (
                    <div className="w-5 h-5 rounded-full bg-emerald-500/30 flex items-center justify-center text-emerald-400">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
