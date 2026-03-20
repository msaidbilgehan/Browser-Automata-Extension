import { useRef, useEffect, useCallback } from "react";
import { EditorView } from "@codemirror/view";
import { EditorState, type Extension } from "@codemirror/state";

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  extensions: Extension[];
  height?: string;
  placeholder?: string;
}

/**
 * CodeMirror 6 editor wrapper component.
 * Lazy-loadable via React.lazy for popup performance.
 */
export function CodeEditor({ value, onChange, extensions, height = "200px" }: CodeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const createUpdateListener = useCallback(() => {
    return EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onChangeRef.current(update.state.doc.toString());
      }
    });
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const state = EditorState.create({
      doc: value,
      extensions: [
        ...extensions,
        createUpdateListener(),
        EditorView.theme({
          "&": { height, fontSize: "12px" },
          ".cm-scroller": { overflow: "auto" },
          ".cm-content": { fontFamily: "monospace" },
        }),
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Only recreate on extensions change, not value change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extensions, height, createUpdateListener]);

  // Sync external value changes (e.g., loading a different script)
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const currentContent = view.state.doc.toString();
    if (currentContent !== value) {
      view.dispatch({
        changes: { from: 0, to: currentContent.length, insert: value },
      });
    }
  }, [value]);

  return <div ref={containerRef} className="border-border overflow-hidden rounded-md border" />;
}
