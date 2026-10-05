import { useEffect, useRef, useState } from "react";
import { format, isSameDay } from "date-fns";
import { ArrowLeft, MessageSquare, SendHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ChatAvatar } from "./ChatAvatar";
import { colleagueName, colleagueRole, formatDaySeparator, type Colleague, type Conversation, type Message } from "./chat-utils";

const GROUP_WINDOW_MS = 5 * 60 * 1000; // mensajes seguidos del mismo autor se agrupan

interface MessageThreadProps {
  conversation: Conversation | undefined;
  messages: Message[];
  loading: boolean;
  myId: string | undefined;
  participants: string[];
  directory: Map<string, Colleague>;
  online: Set<string>;
  onSend: (content: string) => Promise<boolean>;
  onBack: () => void;
}

export function MessageThread({ conversation, messages, loading, myId, participants, directory, online, onSend, onBack }: MessageThreadProps) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Baja al último mensaje al abrir la conversación o al recibir uno nuevo
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, conversation?.id]);

  // Al cambiar de conversación se vacía el borrador y se pone el foco en él
  const [conversacionPrevia, setConversacionPrevia] = useState(conversation?.id);
  if (conversation?.id !== conversacionPrevia) {
    setConversacionPrevia(conversation?.id);
    setDraft("");
  }
  useEffect(() => {
    inputRef.current?.focus();
  }, [conversation?.id]);

  if (!conversation) {
    return (
      <div className="hidden md:flex flex-col items-center justify-center h-full text-center text-muted-foreground p-6">
        <div className="w-14 h-14 rounded-full bg-accent flex items-center justify-center mb-4">
          <MessageSquare className="w-7 h-7 text-accent-foreground" />
        </div>
        <p className="font-medium text-foreground">Selecciona una conversación</p>
        <p className="text-sm mt-1">O empieza una nueva con un compañero o un grupo.</p>
      </div>
    );
  }

  const isGroup = conversation.tipo === "grupo";
  const other = conversation.otro_empleado_id ? directory.get(conversation.otro_empleado_id) : undefined;
  const otherOnline = !!conversation.otro_empleado_id && online.has(conversation.otro_empleado_id);
  const onlineInGroup = participants.filter(id => id !== myId && online.has(id)).length;

  const subtitle = isGroup
    ? `${participants.length} participantes${onlineInGroup > 0 ? ` · ${onlineInGroup} en línea` : ""}`
    : otherOnline
      ? "En línea"
      : colleagueRole(other);

  const handleSend = async () => {
    const content = draft.trim();
    if (!content || sending) return;
    setSending(true);
    const ok = await onSend(content);
    setSending(false);
    if (ok) {
      setDraft("");
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full min-w-0">
      {/* Cabecera */}
      <div className="flex items-center gap-3 px-3 py-2.5 border-b">
        <Button variant="ghost" size="icon" className="md:hidden h-8 w-8" onClick={onBack} aria-label="Volver">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <ChatAvatar name={conversation.nombre} isGroup={isGroup} online={otherOnline} />
        <div className="min-w-0">
          <p className="font-semibold text-sm text-foreground truncate">{conversation.nombre ?? "Conversación"}</p>
          {subtitle && (
            <p className={cn("text-xs truncate", otherOnline ? "text-success" : "text-muted-foreground")}>{subtitle}</p>
          )}
        </div>
      </div>

      {/* Mensajes */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 sm:px-5 py-4 bg-muted/20">
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
            <p className="text-sm">No hay mensajes todavía.</p>
            <p className="text-xs mt-1">Escribe el primero para empezar la conversación.</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {messages.map((message, index) => {
              const date = new Date(message.created_at);
              const prev = messages[index - 1];
              const prevDate = prev ? new Date(prev.created_at) : null;
              const newDay = !prevDate || !isSameDay(date, prevDate);
              const continued =
                !newDay && prev?.autor_id === message.autor_id && date.getTime() - prevDate!.getTime() < GROUP_WINDOW_MS;
              const mine = message.autor_id === myId;
              const author = message.autor_id ? directory.get(message.autor_id) : undefined;

              return (
                <div key={message.id}>
                  {newDay && (
                    <div className="flex justify-center my-4">
                      <span className="text-[11px] font-medium text-muted-foreground bg-card border rounded-full px-3 py-0.5">
                        {formatDaySeparator(date)}
                      </span>
                    </div>
                  )}
                  <div className={cn("flex items-end gap-2", mine ? "justify-end" : "justify-start", !continued && "mt-3")}>
                    {!mine && isGroup && (
                      <div className="w-8 shrink-0">
                        {!continued && <ChatAvatar name={colleagueName(author)} size="sm" />}
                      </div>
                    )}
                    <div
                      className={cn(
                        "max-w-[78%] sm:max-w-[65%] rounded-2xl px-3 py-1.5 shadow-sm",
                        mine ? "bg-primary text-primary-foreground rounded-br-md" : "bg-card border rounded-bl-md"
                      )}
                    >
                      {!mine && isGroup && !continued && (
                        <p className="text-xs font-semibold text-primary mb-0.5">{colleagueName(author)}</p>
                      )}
                      <p className="text-sm whitespace-pre-wrap wrap-break-word">{message.contenido}</p>
                      <p className={cn("text-[10px] text-right mt-0.5", mine ? "text-primary-foreground/70" : "text-muted-foreground")}>
                        {format(date, "HH:mm")}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Redactar */}
      <div className="border-t p-3">
        <div className="flex items-end gap-2">
          <Textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe un mensaje"
            aria-label="Mensaje"
            rows={1}
            maxLength={4000}
            className="min-h-[40px] max-h-32 resize-none"
          />
          <Button
            size="icon"
            className="h-10 w-10 shrink-0"
            onClick={handleSend}
            disabled={!draft.trim() || sending}
            aria-label="Enviar"
          >
            <SendHorizontal className="w-4 h-4" />
          </Button>
        </div>
        <p className="hidden sm:block text-[11px] text-muted-foreground mt-1.5">
          Intro para enviar · Mayús + Intro para salto de línea
        </p>
      </div>
    </div>
  );
}
