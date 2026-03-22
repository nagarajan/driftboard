import type { KeyboardEvent, CSSProperties } from 'react';
import { useState, useRef, useEffect, useCallback } from 'react';

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
    const isModEnter = e.key === 'Enter' && (e.ctrlKey || e.metaKey);
    if (isModEnter) {
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
        title="Ctrl+Enter or Cmd+Enter to save"
        className={`border rounded px-2 py-1 outline-none focus:ring-2 focus:ring-blue-500 ${inputClassName}`}
        style={textControlStyle}
      />
    );
  }

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        skipBlurSaveRef.current = false;
        setIsEditing(true);
      }}
      className={`cursor-pointer rounded px-1 hover:bg-[var(--bg-hover)] whitespace-pre-wrap break-words ${className}`}
      style={{ ...style, minWidth: 0 }}
      title="Click to edit"
    >
      {value || placeholder}
    </div>
  );
}
