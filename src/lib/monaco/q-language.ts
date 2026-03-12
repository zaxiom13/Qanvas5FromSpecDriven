import type * as Monaco from 'monaco-editor';

export function registerQLanguage(monaco: typeof Monaco) {
  monaco.languages.register({ id: 'q' });
  monaco.languages.setLanguageConfiguration('q', {
    comments: {
      lineComment: '/',
    },
    brackets: [
      ['{', '}'],
      ['[', ']'],
      ['(', ')'],
    ],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
    ],
    surroundingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
    ],
  });

  monaco.languages.setMonarchTokensProvider('q', {
    tokenizer: {
      root: [
        [/\/.*$/, 'comment'],
        [/^\\[a-z]+/, 'keyword'],
        [/\{/, 'delimiter.curly'],
        [/\}/, 'delimiter.curly'],
        [/-?[0-9]+[.e]?[0-9]*[ijfhb]?/, 'number'],
        [/`[a-zA-Z0-9._]*/, 'type'],
        [/"([^"\\]|\\.)*"/, 'string'],
        [/\b(select|from|where|by|update|delete|exec|insert|upsert|each|over|scan|prior|flip|enlist|count|first|last|avg|sum|min|max|all|any|not|neg|abs|sqrt|exp|log|sin|cos|tan|string|value|key|type|null|inf|asc|desc|iasc|idesc|distinct|group|ungroup|cols|meta|tables|views|load|save|get|set|til|do|while|if|and|or|like|ss|sv|vs|in|within|bin|binr|asof|aj|aj0|lj|lj0|ij|ij0|pj|uj|wj|wj1|fby|xasc|xdesc|xgroup|xcols|xcept|inter|union|diff|except)\b/, 'keyword'],
        [/[a-zA-Z_][a-zA-Z0-9_.]*/, 'identifier'],
        [/[+\-*%!@#$&|^~<>=?_,;:.]/, 'operator'],
        [/\s+/, 'white'],
      ],
    },
  });

  monaco.editor.defineTheme('qanvas-warm', {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'comment', foreground: 'A89B8E', fontStyle: 'italic' },
      { token: 'keyword', foreground: '7D4E2D' },
      { token: 'number', foreground: '5B6FE8' },
      { token: 'string', foreground: 'B35B3F' },
      { token: 'type', foreground: '8B674B' },
    ],
    colors: {
      'editor.background': '#FFFDF9',
      'editor.foreground': '#2C2520',
      'editorLineNumber.foreground': '#B5A799',
      'editorLineNumber.activeForeground': '#7A6E62',
      'editorCursor.foreground': '#5B6FE8',
      'editor.selectionBackground': '#DDE2FF',
      'editor.inactiveSelectionBackground': '#EEE8DD',
      'editor.lineHighlightBackground': '#F7F1E9',
      'editorIndentGuide.background1': '#EAE0D2',
      'editorWhitespace.foreground': '#D6CABB',
      'editorWidget.background': '#FFFDF9',
      'editorWidget.border': '#E0D8CC',
      'scrollbarSlider.background': '#C9BDABAA',
      'scrollbarSlider.hoverBackground': '#B8AA96CC',
    },
  });
}
