import { useState } from "react";
import { MessageSquarePlus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ChatAvatar } from "./ChatAvatar";
import { formatListTime, type Conversation } from "./chat-utils";

interface ConversationListProps {
  conversations: Conversation[];
  loading: boolean;
  selectedId: string | null;
  myId: string | undefined;
  online: Set<string>;
  onSelect: (id: string) => void;
  onNew: () => void;
}

export function ConversationList({ conversations, loading, selectedId, myId, online, onSelect, onNew }: ConversationListProps) {
  const [search, setSearch] = useState("");

  const filtered = conversations.filter(conv =>
    (conv.nombre ?? "").toLowerCase().includes(search.trim().toLowerCase())
  );

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-foreground">Conversaciones</h2>
          <Button size="sm" className="gap-2" onClick={onNew}>
            <MessageSquarePlus className="w-4 h-4" />
            Nuevo
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar conversación"
            className="pl-9 h-9"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center px-6 py-10 text-muted-foreground">
            {conversations.length === 0 ? (
              <>
                <p className="text-sm mb-3">Aún no tienes conversaciones.</p>
                <Button variant="outline" size="sm" onClick={onNew}>
                  Empezar una
                </Button>
              </>
            ) : (
              <p className="text-sm">No hay conversaciones que coincidan.</p>
            )}
          </div>
        ) : (
          <ul className="p-1.5 space-y-0.5">
            {filtered.map((conv) => {
              const isGroup = conv.tipo === "grupo";
              const unread = conv.no_leidos > 0;
              const mine = conv.ultimo_mensaje_autor_id === myId;

              return (
                <li key={conv.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(conv.id)}
                    className={cn(
                      "w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-colors",
                      selectedId === conv.id ? "bg-accent" : "hover:bg-muted/60"
                    )}
                  >
                    <ChatAvatar
                      name={conv.nombre}
                      isGroup={isGroup}
                      online={!isGroup && !!conv.otro_empleado_id && online.has(conv.otro_empleado_id)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className={cn("truncate text-sm", unread ? "font-semibold text-foreground" : "font-medium text-foreground")}>
                          {conv.nombre ?? "Conversación"}
                        </span>
                        <span className={cn("text-[11px] shrink-0", unread ? "text-primary font-medium" : "text-muted-foreground")}>
                          {formatListTime(conv.ultimo_mensaje_at)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <span className={cn("truncate text-xs", unread ? "text-foreground" : "text-muted-foreground")}>
                          {conv.ultimo_mensaje
                            ? `${mine ? "Tú: " : ""}${conv.ultimo_mensaje}`
                            : isGroup
                              ? `${conv.num_participantes} participantes`
                              : "Sin mensajes todavía"}
                        </span>
                        {unread && (
                          <span className="shrink-0 min-w-5 h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold flex items-center justify-center">
                            {conv.no_leidos > 99 ? "99+" : conv.no_leidos}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
