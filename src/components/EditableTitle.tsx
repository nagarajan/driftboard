import type { KeyboardEvent, CSSProperties } from 'react';
import { useState, useRef, useEffect } from 'react';

interface EditableTitleProps {
  value: string;
  onSave: (value: string) => void;
  className?: string;
  inputClassName?: string;
  placeholder?: string;
  style?: CSSProperties;
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
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  const handleSave = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== value) {
      onSave(trimmed);
    } else {
      setEditValue(value);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setEditValue(value);
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        onClick={(e) => e.stopPropagation()}
        placeholder={placeholder}
        className={`border rounded px-2 py-1 outline-none focus:ring-2 focus:ring-blue-500 ${inputClassName}`}
        style={{ borderColor: 'var(--accent-primary)', backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)', ...style }}
      />
    );
  }

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        setIsEditing(true);
      }}
      className={`cursor-pointer rounded px-1 hover:bg-[var(--bg-hover)] ${className}`}
      style={{ ...style }}
      title="Click to edit"
    >
      {value || placeholder}
    </div>
  );
}
