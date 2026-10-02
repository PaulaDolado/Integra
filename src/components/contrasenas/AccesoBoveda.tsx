import { useState } from "react";
import { Eye, EyeOff, KeyRound, Loader2, Lock, ShieldCheck, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { errorMaestra } from "./contrasenas";
import { IndicadorFuerza } from "./IndicadorFuerza";

export function CampoMaestra({
  id,
  label,
  value,
  onChange,
  autoFocus,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
  autoComplete: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          className="pr-10"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoFocus={autoFocus}
          autoComplete={autoComplete}
          spellCheck={false}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-0.5 top-1/2 h-8 w-8 -translate-y-1/2"
          aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          onClick={() => setVisible((v) => !v)}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

export function CrearBoveda({ onCrear }: { onCrear: (maestra: string) => Promise<void> }) {
  const [maestra, setMaestra] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [creando, setCreando] = useState(false);
  const [intentado, setIntentado] = useState(false);

  const error = errorMaestra(maestra, confirmacion);

  const crear = async (e: React.FormEvent) => {
    e.preventDefault();
    setIntentado(true);
    if (error) return;
    setCreando(true);
    await onCrear(maestra);
    setCreando(false);
  };

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardContent className="space-y-5 pt-6">
        <div className="space-y-2 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <h2 className="text-lg font-semibold">Crea tu bóveda de contraseñas</h2>
          <p className="text-sm text-muted-foreground">
            Elige una contraseña maestra. Con ella se cifran todas tus contraseñas en este navegador antes de guardarse.
          </p>
        </div>

        <form onSubmit={crear} className="space-y-4">
          <div className="space-y-2">
            <CampoMaestra id="maestra-nueva" label="Contraseña maestra" value={maestra} onChange={setMaestra} autoFocus autoComplete="new-password" />
            <IndicadorFuerza contrasena={maestra} />
          </div>
          <CampoMaestra id="maestra-confirmar" label="Repite la contraseña maestra" value={confirmacion} onChange={setConfirmacion} autoComplete="new-password" />

          {intentado && error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-sm dark:border-amber-900 dark:bg-amber-950/30">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p>
              Nadie puede recuperarla, ni siquiera Tecnología. Si la olvidas, tendrás que vaciar la bóveda y perderás las
              contraseñas guardadas.
            </p>
          </div>

          <Button type="submit" className="w-full gap-2" disabled={creando}>
            {creando ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            Crear bóveda
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function DesbloquearBoveda({
  onDesbloquear,
  onOlvidada,
}: {
  onDesbloquear: (maestra: string) => Promise<boolean>;
  onOlvidada: () => void;
}) {
  const [maestra, setMaestra] = useState("");
  const [abriendo, setAbriendo] = useState(false);
  const [incorrecta, setIncorrecta] = useState(false);

  const abrir = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!maestra) return;
    setAbriendo(true);
    const ok = await onDesbloquear(maestra);
    setAbriendo(false);
    if (!ok) {
      setIncorrecta(true);
      setMaestra("");
    }
  };

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardContent className="space-y-5 pt-6">
        <div className="space-y-2 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <h2 className="text-lg font-semibold">Bóveda bloqueada</h2>
          <p className="text-sm text-muted-foreground">Introduce tu contraseña maestra para ver tus contraseñas.</p>
        </div>

        <form onSubmit={abrir} className="space-y-4">
          <CampoMaestra
            id="maestra"
            label="Contraseña maestra"
            value={maestra}
            onChange={(v) => {
              setMaestra(v);
              setIncorrecta(false);
            }}
            autoFocus
            autoComplete="current-password"
          />
          {incorrecta && <p className="text-sm text-destructive">Contraseña maestra incorrecta</p>}
          <Button type="submit" className="w-full gap-2" disabled={abriendo || !maestra}>
            {abriendo ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            {abriendo ? "Descifrando…" : "Desbloquear"}
          </Button>
        </form>

        <button type="button" className="mx-auto block text-sm text-muted-foreground underline-offset-4 hover:underline" onClick={onOlvidada}>
          ¿Has olvidado la contraseña maestra?
        </button>
      </CardContent>
    </Card>
  );
}
