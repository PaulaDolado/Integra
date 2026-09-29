import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MessageSquare } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useEmployeeProfile } from "@/hooks/useEmployeeProfile";
import { useOnlineEmployees } from "@/contexts/PresenceContext";
import { cn } from "@/lib/utils";
import { ConversationList } from "@/components/chat/ConversationList";
import { MessageThread } from "@/components/chat/MessageThread";
import { NewConversationDialog } from "@/components/chat/NewConversationDialog";
import type { Colleague, Conversation, Message } from "@/components/chat/chat-utils";

const MESSAGES_PAGE = 200;

export default function Comunicacion() {
  const { profile } = useEmployeeProfile();
  const myId = profile?.id;
  const online = useOnlineEmployees();
  const { toast } = useToast();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [directory, setDirectory] = useState<Colleague[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [participants, setParticipants] = useState<string[]>([]);
  const [isNewOpen, setIsNewOpen] = useState(false);

  // La suscripción en tiempo real necesita la conversación abierta sin re-suscribirse
  const selectedIdRef = useRef<string | null>(null);
  selectedIdRef.current = selectedId;

  const directoryById = useMemo(() => new Map(directory.map(c => [c.id, c])), [directory]);
  const colleagues = useMemo(() => directory.filter(c => c.id !== myId), [directory, myId]);
  const selectedConversation = conversations.find(c => c.id === selectedId);

  const fetchConversations = useCallback(async () => {
    const { data, error } = await supabase.rpc("mis_conversaciones");
    if (error) {
      console.error("Error fetching conversations:", error);
    } else {
      setConversations(data ?? []);
    }
    setLoadingConversations(false);
  }, []);

  const markAsRead = useCallback(async (conversationId: string) => {
    setConversations(prev => prev.map(c => (c.id === conversationId ? { ...c, no_leidos: 0 } : c)));
    const { error } = await supabase.rpc("marcar_conversacion_leida", { conv_id: conversationId });
    if (error) console.error("Error marking conversation as read:", error);
  }, []);

  useEffect(() => {
    if (!myId) return;

    fetchConversations();
    supabase.rpc("directorio_empleados").then(({ data, error }) => {
      if (error) console.error("Error fetching directory:", error);
      else setDirectory(data ?? []);
    });

    const channel = supabase
      .channel("chat-mensajes")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "mensajes" }, (payload) => {
        const message = payload.new as Message;
        if (message.conversacion_id === selectedIdRef.current) {
          setMessages(prev => (prev.some(m => m.id === message.id) ? prev : [...prev, message]));
          if (message.autor_id !== myId) markAsRead(message.conversacion_id);
        }
        fetchConversations();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [myId, fetchConversations, markAsRead]);

  // Carga los mensajes y participantes de la conversación abierta
  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      setParticipants([]);
      return;
    }

    let cancelled = false;
    setLoadingMessages(true);

    Promise.all([
      supabase
        .from("mensajes")
        .select("*")
        .eq("conversacion_id", selectedId)
        .order("created_at", { ascending: false })
        .limit(MESSAGES_PAGE),
      supabase
        .from("conversacion_participantes")
        .select("empleado_id")
        .eq("conversacion_id", selectedId),
    ]).then(([messagesResult, participantsResult]) => {
      if (cancelled) return;
      if (messagesResult.error) {
        toast({ title: "Error", description: "No se pudieron cargar los mensajes", variant: "destructive" });
      } else {
        setMessages([...(messagesResult.data ?? [])].reverse());
      }
      setParticipants((participantsResult.data ?? []).map(p => p.empleado_id));
      setLoadingMessages(false);
    });

    markAsRead(selectedId);

    return () => {
      cancelled = true;
    };
  }, [selectedId, markAsRead, toast]);

  const handleSend = async (content: string) => {
    if (!selectedId || !myId) return false;

    const { data, error } = await supabase
      .from("mensajes")
      .insert({ conversacion_id: selectedId, autor_id: myId, contenido: content })
      .select()
      .single();

    if (error || !data) {
      toast({ title: "Error", description: "No se pudo enviar el mensaje", variant: "destructive" });
      return false;
    }

    setMessages(prev => (prev.some(m => m.id === data.id) ? prev : [...prev, data]));
    fetchConversations();
    return true;
  };

  const openConversation = async (conversationId: string) => {
    await fetchConversations();
    setSelectedId(conversationId);
    setIsNewOpen(false);
  };

  const handleStartDirect = async (employeeId: string) => {
    const { data, error } = await supabase.rpc("abrir_conversacion_directa", { otro_empleado_id: employeeId });
    if (error || !data) {
      toast({ title: "Error", description: "No se pudo abrir la conversación", variant: "destructive" });
      return;
    }
    await openConversation(data);
  };

  const handleCreateGroup = async (name: string, members: string[]) => {
    const { data, error } = await supabase.rpc("crear_grupo", { nombre_grupo: name, participantes: members });
    if (error || !data) {
      toast({ title: "Error", description: "No se pudo crear el grupo", variant: "destructive" });
      return;
    }
    toast({ title: "Grupo creado", description: `Se ha creado «${name}».` });
    await openConversation(data);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem-1px)] p-4 sm:p-6 gap-4">
      <div>
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
          <MessageSquare className="w-8 h-8 text-primary" />
          Comunicación
        </h1>
        <p className="text-muted-foreground">
          Comunícate con tus compañeros y equipos de trabajo.
        </p>
      </div>

      <Card className="flex-1 min-h-0 flex overflow-hidden">
        <aside
          className={cn(
            "w-full md:w-80 lg:w-96 md:border-r flex-shrink-0",
            selectedId ? "hidden md:block" : "block"
          )}
        >
          <ConversationList
            conversations={conversations}
            loading={loadingConversations}
            selectedId={selectedId}
            myId={myId}
            online={online}
            onSelect={setSelectedId}
            onNew={() => setIsNewOpen(true)}
          />
        </aside>

        <section className={cn("flex-1 min-w-0", selectedId ? "block" : "hidden md:block")}>
          <MessageThread
            conversation={selectedConversation}
            messages={messages}
            loading={loadingMessages}
            myId={myId}
            participants={participants}
            directory={directoryById}
            online={online}
            onSend={handleSend}
            onBack={() => setSelectedId(null)}
          />
        </section>
      </Card>

      <NewConversationDialog
        open={isNewOpen}
        onOpenChange={setIsNewOpen}
        colleagues={colleagues}
        online={online}
        onStartDirect={handleStartDirect}
        onCreateGroup={handleCreateGroup}
      />
    </div>
  );
}
