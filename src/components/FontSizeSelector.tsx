import { useUIStore } from '../store/uiStore';
import type { FontSize } from '../types';

const fontSizes: { value: FontSize; label: string }[] = [
  { value: 'xs', label: 'XS' },
  { value: 'sm', label: 'S' },
  { value: 'md', label: 'M' },
  { value: 'lg', label: 'L' },
  { value: 'xl', label: 'XL' },
];

const TextSizeIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
    {/* Large T */}
    <path d="M2 5h10v2H8v11H6V7H2V5z" />
    {/* Small T */}
    <path d="M13 10h8v1.5h-2.75V18h-2.5v-6.5H13V10z" />
  </svg>
);

export function FontSizeSelector() {
  const { fontSize, setFontSize } = useUIStore();

  return (
    <div className="flex items-center gap-1">
      <span className="mr-1" style={{ color: 'var(--text-header)' }} title="Font size">
        <TextSizeIcon />
      </span>
      <div className="flex border rounded-lg overflow-hidden" style={{ borderColor: 'var(--border-default)' }}>
        {fontSizes.map((size) => (
          <button
            key={size.value}
            onClick={() => setFontSize(size.value)}
            className={`px-2 py-1 text-xs font-medium transition-colors ${fontSize === size.value ? 'bg-[var(--accent-primary)] text-white' : 'bg-[var(--bg-card)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'}`}
            title={`${size.label} font size`}
          >
            {size.label}
          </button>
        ))}
      </div>
    </div>
  );
}
