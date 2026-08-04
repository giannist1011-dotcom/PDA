import { useEffect, useRef, useState } from "react";
import { Bot, Send, Loader2, Sparkles } from "lucide-react";
import { apiAiChat, formatApiError } from "@/lib/api";

const SUGGESTIONS = [
  "Πώς πήγε η βδομάδα;",
  "Ποιο προϊόν πουλάει λιγότερο;",
  "Πόσα έξοδα είχα αυτόν τον μήνα;",
];

// Απλό markdown-lite rendering: **bold** + γραμμές/λίστες, χωρίς dependency
function renderText(text) {
  return text.split("\n").map((line, i) => {
    const parts = line.split(/\*\*(.+?)\*\*/g).map((p, j) =>
      j % 2 === 1 ? (
        <strong key={j} className="font-bold text-white">
          {p}
        </strong>
      ) : (
        p
      )
    );
    return (
      <div key={i} className={line.trim().startsWith("-") ? "pl-3" : ""}>
        {parts.length ? parts : " "}
      </div>
    );
  });
}

export default function DeckPilotChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const send = async (text) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    setError(null);
    setInput("");
    const next = [...messages, { role: "user", content }];
    setMessages(next);
    setLoading(true);
    try {
      const { reply } = await apiAiChat(next.map(({ role, content }) => ({ role, content })));
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
    } catch (e) {
      setError(formatApiError(e));
      setMessages(messages); // αναίρεση του μηνύματος που δεν στάλθηκε
      setInput(content);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0" data-testid="deckpilot-chat">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center gap-4 py-8">
            <div className="w-14 h-14 rounded-full bg-flame/15 border border-flame/40 flex items-center justify-center">
              <Bot className="w-7 h-7 text-flame" />
            </div>
            <div>
              <div className="font-heading font-bold text-lg">DeckPilot</div>
              <div className="text-sm text-neutral-400 mt-1 max-w-xs">
                Ρώτησέ με οτιδήποτε για το κατάστημά σου — πωλήσεις, μενού, έξοδα, ελλείψεις.
              </div>
            </div>
            <div className="flex flex-col gap-2 w-full max-w-sm">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  data-testid="deckpilot-suggestion"
                  className="px-3 py-2.5 rounded-md border border-[#723645] hover:border-flame text-sm text-neutral-200 text-left transition-colors flex items-center gap-2"
                >
                  <Sparkles className="w-3.5 h-3.5 text-gold shrink-0" />
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] px-3.5 py-2.5 rounded-lg text-sm leading-relaxed whitespace-pre-wrap break-words ${
                m.role === "user"
                  ? "bg-flame/20 border border-flame/40 text-white"
                  : "bg-[#3D1620] border border-[#723645] text-neutral-200"
              }`}
            >
              {m.role === "assistant" ? renderText(m.content) : m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="px-3.5 py-2.5 rounded-lg bg-[#3D1620] border border-[#723645] flex items-center gap-2 text-sm text-neutral-400">
              <Loader2 className="w-4 h-4 animate-spin text-flame" />
              Ο DeckPilot σκέφτεται…
            </div>
          </div>
        )}
        {error && (
          <div className="text-center text-xs text-[#FF3B30]" data-testid="deckpilot-error">
            {error}
          </div>
        )}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="shrink-0 p-3 border-t border-[#723645] flex gap-2"
      >
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Γράψε την ερώτησή σου…"
          data-testid="deckpilot-input"
          className="flex-1 h-11 px-3 rounded-md bg-[#3D1620] border border-[#723645] focus:border-flame outline-none text-sm text-white placeholder:text-neutral-500"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          data-testid="deckpilot-send"
          className="h-11 w-11 rounded-md bg-flame text-white flex items-center justify-center disabled:opacity-40 hover:opacity-90 transition-opacity shrink-0"
          aria-label="Αποστολή"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
