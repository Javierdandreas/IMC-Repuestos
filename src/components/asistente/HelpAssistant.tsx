"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { CircleHelp, Send, X } from "lucide-react";
import { getHelpPageContext } from "@/lib/asistente-ayuda";

type Message = { role: "user" | "assistant"; content: string };

const suggestions = [
  "Que puedo hacer en esta pantalla?",
  "Como importo una lista de precios?",
  "Donde veo los costos modificados?",
  "Como exporto precios de mostrador?",
];

function AssistantResponse({ content }: { content: string }) {
  return (
    <div className="space-y-2">
      {content.split(/\r?\n/).map((line, index) => {
        const text = line.trim();
        if (!text) return <div key={`space-${index}`} className="h-1" aria-hidden="true" />;

        const bullet = text.match(/^[-*]\s+(.+)/);
        const numbered = text.match(/^(\d+)[.)]\s+(.+)/);
        if (bullet || numbered) {
          return (
            <div key={`item-${index}`} className="flex gap-2">
              <span className="shrink-0 font-black text-blue-600 dark:text-blue-400">{numbered ? `${numbered[1]}.` : "-"}</span>
              <span>{bullet?.[1] ?? numbered?.[2]}</span>
            </div>
          );
        }

        return <p key={`paragraph-${index}`}>{text}</p>;
      })}
    </div>
  );
}

export function HelpAssistant() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const page = getHelpPageContext(pathname);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages, open, sending]);

  const ask = async (question: string) => {
    const trimmed = question.trim();
    if (!trimmed || sending) return;
    const nextMessages = [...messages, { role: "user" as const, content: trimmed }];
    setMessages(nextMessages);
    setMessage("");
    setError("");
    setSending(true);

    try {
      const response = await fetch("/api/asistente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Cada consulta es independiente: el historial solo se conserva visualmente.
        body: JSON.stringify({ message: trimmed, pathname }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "No se pudo consultar al asistente.");
      setMessages((current) => [...current, { role: "assistant", content: String(data.answer ?? "") }]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo consultar al asistente.");
    } finally {
      setSending(false);
    }
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void ask(message);
  };

  return (
    <>
      {open && (
        <aside aria-label="Asistente de ayuda" className="fixed inset-x-3 bottom-3 z-[90] flex max-h-[min(680px,calc(100dvh-1.5rem))] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-950 sm:inset-x-auto sm:bottom-5 sm:right-5 sm:w-[390px]">
          <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            <div className="min-w-0">
              <h2 className="text-sm font-black text-slate-900 dark:text-white">Ayuda IMC</h2>
              <p className="mt-0.5 truncate text-[11px] font-medium text-slate-500">{page.title}</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} title="Cerrar ayuda" aria-label="Cerrar ayuda" className="inline-flex h-8 w-8 shrink-0 items-center justify-center text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"><X className="h-4 w-4" /></button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            {!messages.length && (
              <div className="space-y-3">
                <p className="text-sm font-medium leading-6 text-slate-600 dark:text-slate-300">Puedo explicarte los flujos y opciones disponibles en IMC.</p>
                <div className="grid gap-2">
                  {suggestions.map((suggestion) => <button key={suggestion} type="button" onClick={() => void ask(suggestion)} className="border border-slate-200 px-3 py-2 text-left text-xs font-bold text-slate-600 transition hover:border-blue-500/40 hover:bg-blue-500/5 hover:text-blue-700 dark:border-slate-800 dark:text-slate-300 dark:hover:text-blue-300">{suggestion}</button>)}
                </div>
              </div>
            )}

            <div className="space-y-3">
              {messages.map((item, index) => (
                <div key={`${item.role}-${index}`} className={`max-w-[90%] px-3 py-2 text-sm leading-5 ${item.role === "user" ? "ml-auto bg-blue-600 text-white" : "border border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"}`}>
                  {item.role === "assistant" ? <AssistantResponse content={item.content} /> : <p className="whitespace-pre-wrap">{item.content}</p>}
                </div>
              ))}
              {sending && <div className="w-fit border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-500 dark:border-slate-800 dark:bg-slate-900">Consultando...</div>}
              {error && <p role="alert" className="border border-red-300 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-300">{error}</p>}
              <div ref={bottomRef} />
            </div>
          </div>

          <form onSubmit={submit} className="flex items-center gap-2 border-t border-slate-200 p-3 dark:border-slate-800">
            <input value={message} onChange={(event) => setMessage(event.target.value)} maxLength={700} placeholder="Escribi tu consulta" className="h-10 min-w-0 flex-1 border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
            <button type="submit" disabled={!message.trim() || sending} title="Enviar consulta" aria-label="Enviar consulta" className="inline-flex h-10 w-10 shrink-0 items-center justify-center bg-blue-600 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"><Send className="h-4 w-4" /></button>
          </form>
        </aside>
      )}

      <button type="button" onClick={() => setOpen((current) => !current)} title="Abrir ayuda" aria-label="Abrir ayuda" className="fixed bottom-5 right-5 z-[80] inline-flex h-12 w-12 items-center justify-center rounded-full border border-blue-400/40 bg-blue-600 text-white shadow-lg transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 dark:focus:ring-offset-slate-950">
        {open ? <X className="h-5 w-5" /> : <CircleHelp className="h-5 w-5" />}
      </button>
    </>
  );
}
