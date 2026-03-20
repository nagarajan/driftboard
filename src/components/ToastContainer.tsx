import { useToastStore, type ToastKind } from '../store/toastStore';

const kindClasses: Record<ToastKind, string> = {
  add: 'bg-emerald-100 text-emerald-900 border border-emerald-200/90 shadow-md',
  delete: 'bg-rose-100 text-rose-900 border border-rose-200/90 shadow-md',
  edit: 'bg-sky-100 text-sky-900 border border-sky-200/90 shadow-md',
  move: 'bg-amber-100 text-amber-900 border border-amber-200/90 shadow-md',
};

export function ToastContainer() {
  const items = useToastStore((s) => s.items);

  return (
    <div
      className="pointer-events-none fixed z-[200] flex flex-col items-end gap-1.5"
      style={{ bottom: 20, right: 20 }}
      aria-live="polite"
    >
      {items.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`pointer-events-auto w-fit max-w-[min(calc(100vw-40px),32rem)] rounded-2xl px-4 py-px text-left text-sm font-medium leading-snug ${kindClasses[t.kind]}`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
