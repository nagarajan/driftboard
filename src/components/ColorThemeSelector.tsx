import { useState, useRef, useEffect } from 'react';
import { useBoardStore } from '../store/boardStore';
import type { Theme } from '../types';
import { DEFAULT_BOARD_THEME } from '../types';

interface ThemeOption {
  value: Theme;
  label: string;
  colors: string[]; // Preview colors for the theme
  category: 'pastel' | 'saturated' | 'dark' | 'niche';
}

const themeOptions: ThemeOption[] = [
  // Pastel themes
  { value: 'rose', label: 'Rose', colors: ['#fce7f3', '#ec4899', '#fbcfe8'], category: 'pastel' },
  { value: 'lavender', label: 'Lavender', colors: ['#ede9fe', '#8b5cf6', '#ddd6fe'], category: 'pastel' },
  { value: 'mint', label: 'Mint', colors: ['#d1fae5', '#10b981', '#a7f3d0'], category: 'pastel' },
  { value: 'peach', label: 'Peach', colors: ['#ffedd5', '#f97316', '#fed7aa'], category: 'pastel' },
  { value: 'sky', label: 'Sky', colors: ['#e0f2fe', '#0ea5e9', '#bae6fd'], category: 'pastel' },
  { value: 'lemon', label: 'Lemon', colors: ['#fefce8', '#ca8a04', '#fef08a'], category: 'pastel' },
  { value: 'lilac', label: 'Lilac', colors: ['#fdf4ff', '#c026d3', '#fae8ff'], category: 'pastel' },
  { value: 'coral', label: 'Coral', colors: ['#fff1f2', '#f43f5e', '#fecdd3'], category: 'pastel' },
  { value: 'sage', label: 'Sage', colors: ['#f1f5eb', '#4d7c0f', '#d9e8c0'], category: 'pastel' },
  // Saturated themes
  { value: 'ocean', label: 'Ocean', colors: ['#0c4a6e', '#0284c7', '#075985'], category: 'saturated' },
  { value: 'forest', label: 'Forest', colors: ['#14532d', '#16a34a', '#166534'], category: 'saturated' },
  { value: 'sunset', label: 'Sunset', colors: ['#7c2d12', '#ea580c', '#9a3412'], category: 'saturated' },
  { value: 'grape', label: 'Grape', colors: ['#4c1d95', '#7c3aed', '#5b21b6'], category: 'saturated' },
  // Dark themes
  { value: 'dark', label: 'Dark', colors: ['#111827', '#1f2937', '#374151'], category: 'dark' },
  { value: 'midnight', label: 'Midnight', colors: ['#060910', '#0f1a2e', '#111e33'], category: 'dark' },
  { value: 'charcoal', label: 'Charcoal', colors: ['#100e0d', '#221f1d', '#1e1b19'], category: 'dark' },
  { value: 'crimson', label: 'Crimson', colors: ['#0f0205', '#7f1d1d', '#1f050d'], category: 'dark' },
  { value: 'slate', label: 'Slate', colors: ['#0d1117', '#161b22', '#1c2230'], category: 'dark' },
  { value: 'amber', label: 'Amber', colors: ['#120d02', '#78350f', '#221808'], category: 'dark' },
  // Niche themes
  { value: 'steampunk', label: 'Steampunk', colors: ['#1a120a', '#5c3a1e', '#b8860b'], category: 'niche' },
  { value: 'futuristic', label: 'Futuristic', colors: ['#0a0e14', '#141c28', '#00b4d8'], category: 'niche' },
];

type CategoryKey = ThemeOption['category'];

const categories: { key: CategoryKey; label: string }[] = [
  { key: 'pastel', label: 'Pastel' },
  { key: 'saturated', label: 'Saturated' },
  { key: 'dark', label: 'Dark' },
  { key: 'niche', label: 'Niche' },
];

const themesByCategory = Object.fromEntries(
  categories.map(({ key }) => [key, themeOptions.filter((t) => t.category === key)])
) as Record<CategoryKey, ThemeOption[]>;

export function ColorThemeSelector() {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<CategoryKey | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const activeBoardId = useBoardStore((s) => s.activeBoardId);
  const boards = useBoardStore((s) => s.boards);
  const setBoardTheme = useBoardStore((s) => s.setBoardTheme);

  const activeBoard = activeBoardId ? boards[activeBoardId] : null;
  const theme = activeBoard?.theme ?? DEFAULT_BOARD_THEME;

  const currentTheme = themeOptions.find((t) => t.value === theme) || themeOptions[0];
  const activeCategory = currentTheme.category;

  useEffect(() => {
    if (isOpen) {
      setExpandedCategory(activeCategory);
    }
  }, [isOpen, activeCategory]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectTheme = (themeValue: Theme) => {
    if (activeBoardId) {
      setBoardTheme(activeBoardId, themeValue);
    }
    setIsOpen(false);
  };

  const renderColorPreview = (colors: string[], size: string = '1em') => (
    <div
      className="rounded-full overflow-hidden flex"
      style={{ width: size, height: size }}
    >
      {colors.map((color, i) => (
        <div
          key={i}
          style={{
            backgroundColor: color,
            width: `${100 / colors.length}%`,
            height: '100%',
          }}
        />
      ))}
    </div>
  );

  const renderCategoryPreview = (categoryKey: CategoryKey) => {
    const items = themesByCategory[categoryKey];
    return (
      <div className="flex" style={{ gap: '0.25em' }}>
        {items.slice(0, 4).map((t) => renderColorPreview(t.colors, '1em'))}
        {items.length > 4 && (
          <span style={{ fontSize: '0.7em', color: 'var(--text-muted)', lineHeight: '1em' }}>
            +{items.length - 4}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => activeBoardId && setIsOpen(!isOpen)}
        disabled={!activeBoardId}
        className="flex items-center gap-1.5 px-3 py-1.5 text-[0.85em] border rounded transition-colors hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          backgroundColor: 'var(--bg-card)',
          borderColor: 'var(--border-default)',
          color: 'var(--text-secondary)',
        }}
        title={activeBoardId ? 'Color theme for this board' : 'Select a board to set its theme'}
      >
        {renderColorPreview(currentTheme.colors, '1rem')}
        <span>{currentTheme.label}</span>
        <svg
          className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div
          className="absolute top-full right-0 mt-2 rounded-lg shadow-lg z-50"
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-default)',
            minWidth: '200px',
          }}
        >
          {categories.map(({ key, label }, idx) => {
            const isExpanded = expandedCategory === key;
            const categoryThemes = themesByCategory[key];
            const hasActiveTheme = categoryThemes.some((t) => t.value === theme);
            const isLast = idx === categories.length - 1;

            return (
              <div key={key} style={!isLast ? { borderBottom: '1px solid var(--border-default)' } : undefined}>
                <button
                  type="button"
                  onClick={() => setExpandedCategory(isExpanded ? null : key)}
                  className="w-full flex items-center rounded transition-colors hover:bg-[var(--bg-hover)]"
                  style={{
                    padding: '0.5em 0.5em',
                    gap: '0.5em',
                    color: 'var(--text-primary)',
                  }}
                >
                  <svg
                    style={{
                      width: '0.75em',
                      height: '0.75em',
                      flexShrink: 0,
                      transition: 'transform 150ms',
                      transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                      color: 'var(--text-muted)',
                    }}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <span className="font-semibold uppercase" style={{ fontSize: '0.7em', color: 'var(--text-muted)' }}>
                    {label}
                  </span>
                  {hasActiveTheme && !isExpanded && (
                    <span style={{ fontSize: '0.75em', color: 'var(--accent-primary)', marginLeft: '0.15em' }}>
                      --
                    </span>
                  )}
                  <div className="ml-auto">
                    {renderCategoryPreview(key)}
                  </div>
                </button>

                {isExpanded && (
                  <div style={{ padding: '0 0.5em 0.5em' }}>
                    {categoryThemes.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => handleSelectTheme(option.value)}
                        className={`w-full flex items-center rounded transition-colors ${theme === option.value ? 'bg-[var(--bg-active)]' : 'hover:bg-[var(--bg-hover)]'}`}
                        style={{
                          padding: '0.4em 0.5em',
                          gap: '0.5em',
                          color: 'var(--text-primary)',
                        }}
                      >
                        {renderColorPreview(option.colors, '1.5em')}
                        <span style={{ fontSize: '0.9em' }}>{option.label}</span>
                        {theme === option.value && (
                          <svg
                            className="ml-auto"
                            style={{ width: '1em', height: '1em', color: 'var(--accent-primary)' }}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
