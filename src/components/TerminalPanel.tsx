import type { RefObject } from 'react';

interface Props {
  lines: Array<{ text: string; kind: 'in' | 'out' | 'err' }>;
  input: string;
  onInputChange: (v: string) => void;
  onSubmit: () => void;
  onHistory: (dir: -1 | 1) => void;
  inputRef: RefObject<HTMLInputElement | null>;
}

export function TerminalPanel({ lines, input, onInputChange, onSubmit, onHistory, inputRef }: Props) {
  return (
    <div className="terminal">
      <div className="terminal-bar">
        <span className="dot red" />
        <span className="dot yellow" />
        <span className="dot green" />
        <span className="terminal-title">git 沙箱终端</span>
      </div>
      <div className="terminal-body" role="log" aria-live="polite">
        {lines.map((l, i) => (
          <div key={i} className={`term-line term-${l.kind}`}>
            {l.kind === 'in' ? <span className="prompt">❯ </span> : null}
            <span>{l.text}</span>
          </div>
        ))}
      </div>
      <form
        className="terminal-input-row"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <span className="prompt">❯</span>
        <input
          ref={inputRef}
          className="terminal-input"
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              onHistory(-1);
            } else if (e.key === 'ArrowDown') {
              e.preventDefault();
              onHistory(1);
            }
          }}
          placeholder="输入 git 命令，例如 git commit -m &quot;feat: x&quot;"
          spellCheck={false}
          autoComplete="off"
          aria-label="Git 命令输入"
        />
      </form>
    </div>
  );
}
