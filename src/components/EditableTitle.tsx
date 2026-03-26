import type { KeyboardEvent, CSSProperties, ReactNode } from 'react';
import { useState, useRef, useEffect, useCallback } from 'react';

const URL_PATTERN = /((https?:\/\/|www\.)[^\s]+)/gi;
const TRAILING_URL_PUNCTUATION = /[.,!?;:]+$/;

function normalizeUrl(url: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  return `https://${url}`;
}

function splitTrailingPunctuation(url: string): { linkText: string; trailingText: string } {
  const trailingMatch = url.match(TRAILING_URL_PUNCTUATION);
  if (!trailingMatch) {
    return { linkText: url, trailingText: '' };
  }

  const trailingText = trailingMatch[0];
  return {
    linkText: url.slice(0, -trailingText.length),
    trailingText,
  };
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false;
  }

  return Boolean(target.closest('a, button, input, textarea, select, option, [role="button"]'));
}

function renderTextWithLinks(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(URL_PATTERN)) {
    const matchedUrl = match[0];
    const matchIndex = match.index ?? 0;

    if (matchIndex > lastIndex) {
      parts.push(text.slice(lastIndex, matchIndex));
    }

    const { linkText, trailingText } = splitTrailingPunctuation(matchedUrl);

    if (linkText) {
      parts.push(
        <a
          key={`${matchIndex}-${linkText}`}
          href={normalizeUrl(linkText)}
          target="_blank"
          rel="noreferrer"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          className="underline"
          style={{ color: 'var(--accent-primary)' }}
        >
          {linkText}
        </a>
      );
    }

    if (trailingText) {
      parts.push(trailingText);
    }

    lastIndex = matchIndex + matchedUrl.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

interface EditableTitleProps {
  value: string;
  onSave: (value: string) => void;
  className?: string;
  inputClassName?: string;
  placeholder?: string;
  style?: CSSProperties;
}

function styleForTextControl(base: CSSProperties | undefined): CSSProperties | undefined {
  if (!base) return undefined;
  const { display: _display, alignItems: _alignItems, justifyContent: _justify, ...rest } = base;
  return rest;
}

export function EditableTitle({
  value,
  onSave,
  className = '',
  inputClassName = '',
  placeholder = 'Enter title...',
  style,
}: EditableTitleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const skipBlurSaveRef = useRef(false);

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
      adjustHeight();
    }
  }, [isEditing, adjustHeight]);

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  useEffect(() => {
    if (isEditing) {
      adjustHeight();
    }
  }, [editValue, isEditing, adjustHeight]);

  const commitEdit = useCallback(() => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== value) {
      onSave(trimmed);
    } else {
      setEditValue(value);
    }
    setIsEditing(false);
  }, [editValue, value, onSave]);

  const handleBlur = () => {
    if (skipBlurSaveRef.current) {
      skipBlurSaveRef.current = false;
      return;
    }
    commitEdit();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      setEditValue(value);
      setIsEditing(false);
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      skipBlurSaveRef.current = true;
      commitEdit();
    }
  };

  const textControlStyle: CSSProperties = {
    borderColor: 'var(--accent-primary)',
    backgroundColor: 'var(--bg-input)',
    color: 'var(--text-primary)',
    width: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
    overflow: 'hidden',
    overflowWrap: 'anywhere',
    wordBreak: 'break-word',
    resize: 'none',
    ...styleForTextControl(style),
  };

  if (isEditing) {
    return (
      <textarea
        ref={textareaRef}
        value={editValue}
        onChange={(e) => {
          setEditValue(e.target.value);
          requestAnimationFrame(() => adjustHeight());
        }}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        onClick={(e) => e.stopPropagation()}
        placeholder={placeholder}
        rows={1}
        title="Enter to save, Shift+Enter for newline"
        className={`border rounded px-2 py-1 outline-none focus:ring-2 focus:ring-blue-500 ${inputClassName}`}
        style={textControlStyle}
      />
    );
  }

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        if (isInteractiveTarget(e.target)) {
          return;
        }
        skipBlurSaveRef.current = false;
        setIsEditing(true);
      }}
      className={`cursor-pointer rounded px-1 hover:bg-[var(--bg-hover)] whitespace-pre-wrap ${className}`}
      style={{
        ...style,
        minWidth: 0,
        overflowX: 'hidden',
        overflowWrap: 'anywhere',
        wordBreak: 'break-word',
      }}
      title="Click to edit"
    >
      {value ? renderTextWithLinks(value) : placeholder}
    </div>
  );
}
