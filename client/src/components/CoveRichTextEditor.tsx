/**
 * CoveRichTextEditor
 *
 * Shared rich-text / HTML editor component — identical look and feel to the
 * product editor in AdminProductEdit.tsx.  Used by the Visual Builder popup
 * for Text Section (and future components).
 *
 * Props:
 *   value    – current HTML string
 *   onChange – called with the new HTML string on every change
 *   dir      – 'ltr' (default) | 'rtl' for Arabic fields
 *   placeholder – optional placeholder text shown in Code mode
 */
import React, { useEffect, useRef, useState } from 'react';

const EDITOR_TEXT_COLORS = [
  { label: 'Black',   value: '#111827' },
  { label: 'Gold',    value: '#a8873f' },
  { label: 'Red',     value: '#dc2626' },
  { label: 'Gray',    value: '#475569' },
  { label: 'White',   value: '#ffffff' },
];

interface CoveRichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  dir?: 'ltr' | 'rtl';
  placeholder?: string;
  minHeight?: number;
}

export function CoveRichTextEditor({
  value,
  onChange,
  dir = 'ltr',
  placeholder,
  minHeight = 160,
}: CoveRichTextEditorProps) {
  const [mode, setMode] = useState<'visual' | 'code'>('visual');
  const editorRef = useRef<HTMLDivElement | null>(null);
  const savedRangeRef = useRef<Range | null>(null);

  // Sync external value → editor DOM (only when not focused)
  useEffect(() => {
    if (mode !== 'visual') return;
    const editor = editorRef.current;
    if (!editor) return;
    if (document.activeElement === editor) return;
    if (editor.innerHTML !== (value || '')) {
      editor.innerHTML = value || '';
    }
  }, [value, mode]);

  const saveSelection = () => {
    const editor = editorRef.current;
    const sel = window.getSelection();
    if (!editor || !sel || sel.rangeCount === 0 || !sel.anchorNode) return;
    if (editor.contains(sel.anchorNode)) {
      savedRangeRef.current = sel.getRangeAt(0).cloneRange();
    }
  };

  const restoreSelection = () => {
    const editor = editorRef.current;
    const range = savedRangeRef.current;
    if (!editor || !range) return;
    const sel = window.getSelection();
    if (!sel) return;
    editor.focus();
    sel.removeAllRanges();
    sel.addRange(range);
  };

  const syncVisualValue = () => {
    const html = editorRef.current?.innerHTML ?? '';
    onChange(html);
  };

  const runCommand = (command: string, commandValue?: string) => {
    restoreSelection();
    document.execCommand(command, false, commandValue);
    syncVisualValue();
  };

  const addLink = () => {
    restoreSelection();
    const url = window.prompt('Enter URL', 'https://');
    if (url) {
      const html = `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
      document.execCommand('insertHTML', false, html);
      syncVisualValue();
    }
  };

  const btnClass =
    'min-w-8 rounded border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 select-none';

  const visualEditorClass =
    'min-h-[var(--editor-min-h)] w-full px-3 py-2 text-sm leading-7 text-[#242424] focus:outline-none overflow-auto';

  return (
    <div
      className="overflow-hidden rounded-lg border border-slate-200 bg-white"
      style={{ '--editor-min-h': `${minHeight}px` } as React.CSSProperties}
    >
      {/* Mode toggle */}
      <div className="flex items-center justify-end border-b border-slate-200 bg-slate-50 px-3 py-1">
        <div className="flex overflow-hidden rounded border border-slate-300 text-xs">
          <button
            type="button"
            className={`border-r border-slate-300 px-3 py-1 ${mode === 'visual' ? 'bg-white font-semibold text-slate-900' : 'bg-slate-100 text-slate-600'}`}
            onClick={() => setMode('visual')}
          >
            Visual
          </button>
          <button
            type="button"
            className={`px-3 py-1 ${mode === 'code' ? 'bg-white font-semibold text-slate-900' : 'bg-slate-100 text-slate-600'}`}
            onClick={() => setMode('code')}
          >
            Code
          </button>
        </div>
      </div>

      {mode === 'visual' ? (
        <>
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-slate-50 px-3 py-2">
            <select
              className="h-8 rounded border border-slate-300 bg-white px-2 text-xs"
              defaultValue="P"
              onChange={(e) => { runCommand('formatBlock', e.target.value); e.currentTarget.value = 'P'; }}
            >
              <option value="P">Paragraph</option>
              <option value="H2">Heading 2</option>
              <option value="H3">Heading 3</option>
              <option value="BLOCKQUOTE">Quote</option>
            </select>
            <button type="button" className={btnClass} onMouseDown={(e) => { e.preventDefault(); runCommand('bold'); }}>B</button>
            <button type="button" className={btnClass} onMouseDown={(e) => { e.preventDefault(); runCommand('italic'); }}><em>I</em></button>
            <button type="button" className={btnClass} onMouseDown={(e) => { e.preventDefault(); runCommand('underline'); }}><span className="underline">U</span></button>
            {/* Text color swatches */}
            <div className="flex items-center gap-1 rounded border border-slate-200 bg-white px-1 py-0.5" title="Text color">
              <span className="px-1 text-[11px] font-semibold text-slate-600">Color</span>
              {EDITOR_TEXT_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  className="h-6 w-6 rounded border border-slate-300"
                  style={{ backgroundColor: c.value }}
                  title={c.label}
                  onMouseDown={(e) => { e.preventDefault(); runCommand('foreColor', c.value); }}
                />
              ))}
              <input
                type="color"
                className="h-6 w-7 cursor-pointer rounded border border-slate-300 bg-white p-0"
                title="Custom color"
                defaultValue="#111827"
                onMouseDown={saveSelection}
                onChange={(e) => runCommand('foreColor', e.target.value)}
              />
            </div>
            <button type="button" className={btnClass} onMouseDown={(e) => { e.preventDefault(); runCommand('insertUnorderedList'); }}>• List</button>
            <button type="button" className={btnClass} onMouseDown={(e) => { e.preventDefault(); runCommand('insertOrderedList'); }}>1. List</button>
            <button type="button" className={btnClass} onMouseDown={(e) => { e.preventDefault(); runCommand('justifyLeft'); }}>Left</button>
            <button type="button" className={btnClass} onMouseDown={(e) => { e.preventDefault(); runCommand('justifyCenter'); }}>Center</button>
            <button type="button" className={btnClass} onMouseDown={(e) => { e.preventDefault(); runCommand('justifyRight'); }}>Right</button>
            <button type="button" className={btnClass} onMouseDown={(e) => { e.preventDefault(); addLink(); }}>Link</button>
            <button type="button" className={btnClass} onMouseDown={(e) => { e.preventDefault(); runCommand('unlink'); }}>Unlink</button>
            <button type="button" className={btnClass} onMouseDown={(e) => { e.preventDefault(); runCommand('removeFormat'); }}>Clear</button>
          </div>
          {/* Editable area */}
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            dir={dir}
            className={visualEditorClass}
            onInput={syncVisualValue}
            onMouseUp={saveSelection}
            onKeyUp={saveSelection}
            onBlur={syncVisualValue}
          />
          <div className="border-t border-slate-200 bg-slate-50 px-3 py-1 text-[11px] text-muted-foreground">
            Visual editor. Use Code mode for exact HTML markup.
          </div>
        </>
      ) : (
        <textarea
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-none border-0 p-3 font-mono text-xs focus:outline-none"
          style={{ minHeight: `${minHeight}px` }}
          placeholder={placeholder || '<p>Enter HTML here...</p>'}
          dir={dir}
        />
      )}
    </div>
  );
}
