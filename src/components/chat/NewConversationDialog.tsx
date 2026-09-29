import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { ChatAvatar } from "./ChatAvatar";
import { colleagueName, colleagueRole, type Colleague } from "./chat-utils";

interface NewConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  colleagues: Colleague[];
  online: Set<string>;
  onStartDirect: (employeeId: string) => Promise<void>;
  onCreateGroup: (name: string, members: string[]) => Promise<void>;
}

export function NewConversationDialog({ open, onOpenChange, colleagues, online, onStartDirect, onCreateGroup }: NewConversationDialogProps) {
  const [tab, setTab] = useState<"persona" | "grupo">("persona");
  const [search, setSearch] = useState("");
  const [groupName, setGroupName] = useState("");
  const [members, setMembers] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setTab("persona");
      setSearch("");
      setGroupName("");
      setMembers(new Set());
    }
  }, [open]);

  const query = search.trim().toLowerCase();
  const filtered = colleagues.filter(c =>
    [colleagueName(c), c.segundo_apellido, c.cargo, c.departamento]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(query)
  );

  const toggleMember = (id: string) => {
    setMembers(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  };

  const colleagueRow = (colleague: Colleague, trailing?: React.ReactNode) => (
    <>
      <ChatAvatar name={colleagueName(colleague)} online={online.has(colleague.id)} size="sm" />
      <div className="flex-1 min-w-0 text-left">
        <p className="text-sm font-medium text-foreground truncate">{colleagueName(colleague)}</p>
        {colleagueRole(colleague) && (
          <p className="text-xs text-muted-foreground truncate">{colleagueRole(colleague)}</p>
        )}
      </div>
      {trailing}
    </>
  );

  const searchBox = (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar por nombre, cargo o departamento"
        className="pl-9"
      />
    </div>
  );

  const emptyState = (
    <p className="text-sm text-muted-foreground text-center py-8">
      {colleagues.length === 0 ? "No hay otros empleados todavía." : "Nadie coincide con la búsqueda."}
    </p>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Nueva conversación</DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(value) => setTab(value as "persona" | "grupo")}>
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="persona">Con una persona</TabsTrigger>
            <TabsTrigger value="grupo">Grupo</TabsTrigger>
          </TabsList>

          <TabsContent value="persona" className="space-y-3">
            {searchBox}
            <div className="max-h-72 overflow-y-auto -mx-2">
              {filtered.length === 0 ? emptyState : filtered.map((colleague) => (
                <button
                  type="button"
                  key={colleague.id}
                  disabled={busy}
                  onClick={() => run(() => onStartDirect(colleague.id))}
                  className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-muted/60 transition-colors disabled:opacity-50"
                >
                  {colleagueRow(colleague)}
                </button>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="grupo" className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="nombre-grupo">Nombre del grupo</Label>
              <Input
                id="nombre-grupo"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Ej. Equipo de Tecnología"
                maxLength={100}
              />
            </div>
            {searchBox}
            <div className="max-h-56 overflow-y-auto -mx-2">
              {filtered.length === 0 ? emptyState : filtered.map((colleague) => {
                const checked = members.has(colleague.id);
                return (
                  <label
                    key={colleague.id}
                    className={cn(
                      "flex items-center gap-3 px-2 py-2 rounded-lg cursor-pointer transition-colors",
                      checked ? "bg-accent/60" : "hover:bg-muted/60"
                    )}
                  >
                    {colleagueRow(colleague, (
                      <Checkbox checked={checked} onCheckedChange={() => toggleMember(colleague.id)} />
                    ))}
                  </label>
                );
              })}
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-muted-foreground">
                {members.size === 0 ? "Selecciona al menos una persona" : `${members.size} seleccionados`}
              </span>
              <Button
                disabled={busy || !groupName.trim() || members.size === 0}
                onClick={() => run(() => onCreateGroup(groupName.trim(), [...members]))}
              >
                Crear grupo
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
