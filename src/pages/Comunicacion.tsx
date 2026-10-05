import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquare } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { comprobar } from "@/lib/query-client";
import { useAvisarError } from "@/hooks/useAvisarError";
import { useEmployeeProfile } from "@/hooks/useEmployeeProfile";
import { useOnlineEmployees } from "@/contexts/PresenceContext";
import { cn } from "@/lib/utils";
import { ConversationList } from "@/components/chat/ConversationList";
import { MessageThread } from "@/components/chat/MessageThread";
import { NewConversationDialog } from "@/components/chat/NewConversationDialog";
import type { Colleague, Conversation, Message } from "@/components/chat/chat-utils";

const MESSAGES_PAGE = 200;

// Valores por defecto estables: los mensajes van en dependencias de efectos (scroll al último)
const NO_CONVERSATIONS: Conversation[] = [];
const NO_COLLEAGUES: Colleague[] = [];
const NO_MESSAGES: Message[] = [];
const NO_PARTICIPANTS: string[] = [];

const messagesKey = (conversationId: string | null) => ["mensajes", conversationId];

export default function Comunicacion() {
  const { profile } = useEmployeeProfile();
  const myId = profile?.id;
  const online = useOnlineEmployees();
  const { toast } = useToast();

  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isNewOpen, setIsNewOpen] = useState(false);

  // La suscripción en tiempo real necesita la conversación abierta sin re-suscribirse
  const selectedIdRef = useRef<string | null>(null);
  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  const conversationsKey = useMemo(() => ["conversaciones", myId], [myId]);

  const { data: conversations = NO_CONVERSATIONS, isLoading: conversationsPending } = useQuery({
    queryKey: conversationsKey,
    queryFn: async () => comprobar(await supabase.rpc("mis_conversaciones")) ?? [],
    enabled: !!myId,
  });
  // Sin ficha de empleado no hay conversaciones que cargar: se sigue mostrando la carga, como antes
  const loadingConversations = !myId || conversationsPending;

  const { data: directory = NO_COLLEAGUES } = useQuery({
    queryKey: ["directorio-empleados"],
    queryFn: async () => comprobar(await supabase.rpc("directorio_empleados")) ?? [],
    enabled: !!myId,
  });

  // Mensajes y participantes de la conversación abierta
  const { data: messages = NO_MESSAGES, isLoading: messagesPending, error: messagesError } = useQuery({
    queryKey: messagesKey(selectedId),
    queryFn: async () => {
      const data = comprobar(
        await supabase
          .from("mensajes")
          .select("*")
          .eq("conversacion_id", selectedId!)
          .order("created_at", { ascending: false })
          .limit(MESSAGES_PAGE)
      );
      return [...(data ?? [])].reverse();
    },
    enabled: !!selectedId,
  });
  useAvisarError(messagesError, "No se pudieron cargar los mensajes");

  const { data: participants = NO_PARTICIPANTS, isLoading: participantsPending } = useQuery({
    queryKey: ["conversacion-participantes", selectedId],
    queryFn: async () => {
      const data = comprobar(
        await supabase.from("conversacion_participantes").select("empleado_id").eq("conversacion_id", selectedId!)
      );
      return (data ?? []).map(p => p.empleado_id);
    },
    enabled: !!selectedId,
  });
  const loadingMessages = messagesPending || participantsPending;

  const directoryById = useMemo(() => new Map(directory.map(c => [c.id, c])), [directory]);
  const colleagues = useMemo(() => directory.filter(c => c.id !== myId), [directory, myId]);
  const selectedConversation = conversations.find(c => c.id === selectedId);

  const refreshConversations = useCallback(
    () => queryClient.invalidateQueries({ queryKey: conversationsKey }),
    [queryClient, conversationsKey]
  );

  // Añade un mensaje a la caché de su conversación (si está cargada) sin duplicarlo
  const appendMessage = useCallback(
    (message: Message) => {
      queryClient.setQueryData<Message[]>(messagesKey(message.conversacion_id), prev =>
        !prev || prev.some(m => m.id === message.id) ? prev : [...prev, message]
      );
    },
    [queryClient]
  );

  const markAsRead = useCallback(
    async (conversationId: string) => {
      queryClient.setQueryData<Conversation[]>(conversationsKey, prev =>
        prev?.map(c => (c.id === conversationId ? { ...c, no_leidos: 0 } : c))
      );
      const { error } = await supabase.rpc("marcar_conversacion_leida", { conv_id: conversationId });
      if (error) console.error("Error marking conversation as read:", error);
    },
    [queryClient, conversationsKey]
  );

  useEffect(() => {
    if (!myId) return;

    const channel = supabase
      .channel("chat-mensajes")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "mensajes" }, (payload) => {
        const message = payload.new as Message;
        // También las conversaciones que no están abiertas, para que su caché no se quede atrás
        appendMessage(message);
        if (message.conversacion_id === selectedIdRef.current && message.autor_id !== myId) {
          markAsRead(message.conversacion_id);
        }
        refreshConversations();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [myId, appendMessage, markAsRead, refreshConversations]);

  // Al abrir una conversación se marca como leída
  useEffect(() => {
    if (selectedId) markAsRead(selectedId);
  }, [selectedId, markAsRead]);

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

    appendMessage(data);
    refreshConversations();
    return true;
  };

  const openConversation = async (conversationId: string) => {
    await refreshConversations();
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
        <h1 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2">
          <MessageSquare className="w-6 h-6 text-primary" />
          Comunicación
        </h1>
        <p className="text-muted-foreground">
          Comunícate con tus compañeros y equipos de trabajo.
        </p>
      </div>

      <Card className="flex-1 min-h-0 flex overflow-hidden">
        <aside
          className={cn(
            "w-full md:w-80 lg:w-96 md:border-r shrink-0",
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
