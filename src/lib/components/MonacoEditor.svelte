<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import type * as Monaco from 'monaco-editor';
  import { registerQLanguage } from '$lib/monaco/q-language';

  type Props = {
    value: string;
    activeKey: string;
    onChange: (value: string) => void;
  };

  let { value, activeKey, onChange }: Props = $props();

  let container = $state<HTMLDivElement | null>(null);
  let editor = $state<Monaco.editor.IStandaloneCodeEditor | null>(null);
  let monacoRef = $state<typeof Monaco | null>(null);
  let currentKey = $state('');
  let isApplyingExternalValue = false;

  function dispatchShortcut(name: string) {
    window.dispatchEvent(new CustomEvent(name));
  }

  function runEditorAction(actionId: string) {
    void editor?.getAction(actionId)?.run();
  }

  onMount(async () => {
    const monaco = await import('monaco-editor');
    monacoRef = monaco;
    registerQLanguage(monaco);

    if (!container) return;

    editor = monaco.editor.create(container, {
      value,
      language: 'q',
      theme: 'qanvas-warm',
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: 13,
      lineHeight: 20,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      wordWrap: 'off',
      padding: { top: 16, bottom: 16 },
      renderLineHighlight: 'line',
      cursorBlinking: 'smooth',
      smoothScrolling: true,
      automaticLayout: true,
      tabSize: 2,
      insertSpaces: true,
      renderWhitespace: 'selection',
      folding: true,
      lineNumbers: 'on',
      glyphMargin: false,
      overviewRulerBorder: false,
      scrollbar: {
        verticalScrollbarSize: 6,
        horizontalScrollbarSize: 6,
      },
    });

    editor.onDidChangeModelContent(() => {
      if (isApplyingExternalValue || !editor) return;
      onChange(editor.getValue());
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => dispatchShortcut('qanvas:save'));
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyB, () => dispatchShortcut('qanvas:toggle-sidebar'));
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyE, () => dispatchShortcut('qanvas:toggle-examples'));
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyO, () => dispatchShortcut('qanvas:toggle-projects'));
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyN, () => dispatchShortcut('qanvas:new-sketch'));

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Slash, () => {
      runEditorAction('editor.action.commentLine');
    });
    editor.addCommand(monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.DownArrow, () => {
      runEditorAction('editor.action.copyLinesDownAction');
    });
    editor.addCommand(monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.UpArrow, () => {
      runEditorAction('editor.action.copyLinesUpAction');
    });
    editor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.DownArrow, () => {
      runEditorAction('editor.action.moveLinesDownAction');
    });
    editor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.UpArrow, () => {
      runEditorAction('editor.action.moveLinesUpAction');
    });
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      runEditorAction('editor.action.insertLineAfter');
    });
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Enter, () => {
      runEditorAction('editor.action.insertLineBefore');
    });
  });

  onDestroy(() => {
    editor?.dispose();
  });

  $effect(() => {
    if (!editor) return;

    if (currentKey !== activeKey) {
      currentKey = activeKey;
      isApplyingExternalValue = true;
      editor.setValue(value);
      isApplyingExternalValue = false;
      return;
    }

    if (value !== editor.getValue()) {
      isApplyingExternalValue = true;
      editor.setValue(value);
      isApplyingExternalValue = false;
    }
  });
</script>

<div bind:this={container} id="monaco-editor"></div>
