'use client';

import { useState } from 'react';

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleClick() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleClick}
      className="shrink-0 rounded border px-3 py-1.5 text-sm hover:bg-slate-50"
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}
