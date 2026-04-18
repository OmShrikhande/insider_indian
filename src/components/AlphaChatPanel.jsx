import { useState, useRef, useEffect } from 'react';
import { alphaChatReply } from '../lib/alphaChatEngine';

const seed = () => [
  {
    role: 'assistant',
    text:
      'ALPHA_LOCAL // deterministic quant desk simulator. No external APIs. Type help.',
  },
];

/**
 * Pure local chat UI — responses from alphaChatEngine only.
 */
const AlphaChatPanel = ({ selectedSymbol, isFnoMode, fnoExpiry }) => {
  const [messages, setMessages] = useState(seed);
  const [input, setInput] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const send = () => {
    const q = input.trim();
    if (!q) return;
    const reply = alphaChatReply(q, {
      selectedSymbol,
      isFnoMode,
      fnoExpiry,
    });
    setMessages((prev) => [...prev, { role: 'user', text: q }, { role: 'assistant', text: reply }]);
    setInput('');
  };

  return (
    <div className="h-full flex flex-col bg-[#050505] text-[#d1d4dc]">
      <div className="px-3 py-2 border-b border-[#1c2127] text-[9px] text-[#5d606b] font-mono tracking-widest">
        CONTEXT {String(selectedSymbol || '—').toUpperCase()} · FNO_{isFnoMode ? 'ON' : 'OFF'}
        {fnoExpiry ? ` · EXP_${fnoExpiry}` : ''}
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar px-3 py-2 space-y-2 text-[11px] font-mono leading-relaxed">
        {messages.map((msg, i) => (
          <div
            key={`${i}-${msg.role}`}
            className={`rounded border px-2 py-1.5 whitespace-pre-wrap ${
              msg.role === 'user'
                ? 'border-[#00f2ff]/30 bg-[#00f2ff]/5 text-[#b8e8ff] ml-4'
                : 'border-[#1c2127] bg-[#0a0a0a] text-[#c8cdd5] mr-4'
            }`}
          >
            {msg.role === 'user' ? '> ' : 'α '}
            {msg.text}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="p-2 border-t border-[#1c2127] flex gap-2">
        <input
          className="flex-1 bg-black border border-[#1c2127] rounded px-2 py-2 text-[11px] font-mono text-[#e0e0e0] focus:outline-none focus:border-[#00f2ff]/50"
          placeholder="Ask: risk, fno, pcr, iv, journal…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
        />
        <button
          type="button"
          onClick={send}
          className="px-3 py-2 rounded border border-[#39ff14]/40 bg-[#39ff14]/10 text-[#39ff14] text-[10px] font-black tracking-widest hover:bg-[#39ff14]/20"
        >
          SEND
        </button>
      </div>
    </div>
  );
};

export default AlphaChatPanel;
