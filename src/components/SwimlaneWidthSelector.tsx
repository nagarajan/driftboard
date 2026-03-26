import { SWIMLANE_WIDTH_OPTIONS } from '../constants/swimlaneWidth';
import { useUIStore } from '../store/uiStore';

const ColumnsWidthIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h6v12H4zM14 6h6v12h-6z" />
  </svg>
);

export function SwimlaneWidthSelector() {
  const { swimlaneWidth, setSwimlaneWidth } = useUIStore();

  return (
    <div className="flex items-center gap-1 border rounded-lg px-2 py-0.5" style={{ borderColor: 'var(--border-default)' }}>
      <span className="mr-1" style={{ color: 'var(--text-header)' }} title="Swimlane width">
        <ColumnsWidthIcon />
      </span>
      <div className="flex border rounded overflow-hidden" style={{ borderColor: 'var(--border-default)' }}>
        {SWIMLANE_WIDTH_OPTIONS.map((option) => (
          <button
            key={option.value}
            onClick={() => setSwimlaneWidth(option.value)}
            className={`px-2 py-1 text-xs font-medium transition-colors ${
              swimlaneWidth === option.value
                ? 'bg-[var(--accent-primary)] text-white'
                : 'bg-[var(--bg-card)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
            }`}
            title={`${option.label} swimlane width`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
