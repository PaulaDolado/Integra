import { useEffect, useState } from "react";
import type { Factor } from "@supabase/supabase-js";
import { ShieldCheck, ShieldOff, Smartphone, MessageSquare, KeyRound, Mail } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SettingsSection } from "./SettingsSection";
import { appUrl } from "@/lib/app-url";

function MethodRow({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ElementType;
  title: string;
  description: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex gap-3">
        <Icon className="w-5 h-5 mt-0.5 shrink-0 text-muted-foreground" />
        <div>
          <p className="font-medium">{title}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {children && <div className="flex items-center gap-2 sm:shrink-0">{children}</div>}
    </div>
  );
}

function CorreoInicioSesion() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState("");

  const save = async () => {
    if (!email.trim() || email.trim() === user?.email) {
      toast.error("Introduce un correo electrónico distinto al actual");
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser(
      { email: email.trim() },
      { emailRedirectTo: appUrl("/configuracion") }
    );
    setSaving(false);

    if (error) {
      console.error("Error updating login email:", error);
      toast.error("No se pudo cambiar el correo electrónico");
      return;
    }
    toast.success("Te hemos enviado un enlace para confirmar el cambio de correo");
    setOpen(false);
  };

  return (
    <SettingsSection title="Correo electrónico de inicio de sesión">
      <p className="text-sm text-muted-foreground">
        El correo electrónico de inicio de sesión de tu cuenta de Integra es{" "}
        <span className="font-medium text-foreground">{user?.email}</span>.
      </p>
      {user?.new_email && (
        <p className="mt-2 text-sm text-muted-foreground">
          Cambio pendiente de confirmar a <span className="font-medium text-foreground">{user.new_email}</span>.
        </p>
      )}
      <Button
        variant="outline"
        className="mt-4"
        onClick={() => {
          setEmail("");
          setOpen(true);
        }}
      >
        Modificar mi correo electrónico
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Modificar correo electrónico</DialogTitle>
            <DialogDescription>
              Recibirás un enlace en la nueva dirección para confirmar el cambio.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="nuevo_email">Nuevo correo electrónico</Label>
            <Input id="nuevo_email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Enviando..." : "Enviar enlace"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SettingsSection>
  );
}

function CambiarContrasenaDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [saving, setSaving] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  // Supabase puede exigir un código enviado por email para confirmar el cambio
  const [needsNonce, setNeedsNonce] = useState(false);
  const [nonce, setNonce] = useState("");

  useEffect(() => {
    if (open) {
      setPassword("");
      setConfirm("");
      setNonce("");
      setNeedsNonce(false);
    }
  }, [open]);

  const save = async () => {
    if (password.length < 8) {
      toast.error("La contraseña debe tener al menos 8 caracteres");
      return;
    }
    if (password !== confirm) {
      toast.error("Las contraseñas no coinciden");
      return;
    }

    setSaving(true);
    const { error } = await supabase.auth.updateUser({
      password,
      ...(needsNonce ? { nonce: nonce.trim() } : {}),
    });

    if (error?.code === "reauthentication_needed") {
      const { error: reauthError } = await supabase.auth.reauthenticate();
      setSaving(false);
      if (reauthError) {
        toast.error("No se pudo enviar el código de verificación");
        return;
      }
      setNeedsNonce(true);
      toast.info("Te hemos enviado un código por email para confirmar el cambio");
      return;
    }
    setSaving(false);

    if (error) {
      console.error("Error updating password:", error);
      toast.error(
        error.code === "same_password"
          ? "La nueva contraseña debe ser distinta a la actual"
          : error.code === "weak_password"
            ? "La contraseña es demasiado débil"
            : "No se pudo cambiar la contraseña"
      );
      return;
    }
    toast.success("Contraseña actualizada");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cambiar mi contraseña</DialogTitle>
          <DialogDescription>Usa al menos 8 caracteres.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nueva_contrasena">Nueva contraseña</Label>
            <Input id="nueva_contrasena" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmar_contrasena">Confirmar contraseña</Label>
            <Input id="confirmar_contrasena" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          {needsNonce && (
            <div className="space-y-2">
              <Label htmlFor="nonce">Código recibido por email</Label>
              <Input id="nonce" inputMode="numeric" autoComplete="one-time-code" value={nonce} onChange={(e) => setNonce(e.target.value)} />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving || (needsNonce && !nonce.trim())}>
            {saving ? "Guardando..." : "Cambiar contraseña"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MetodosLogin() {
  const { user } = useAuth();
  const [passwordOpen, setPasswordOpen] = useState(false);
  const identities = user?.identities ?? [];
  const google = identities.find((i) => i.provider === "google");

  const linkGoogle = async () => {
    const { error } = await supabase.auth.linkIdentity({
      provider: "google",
      options: { redirectTo: appUrl("/configuracion") },
    });
    if (error) {
      console.error("Error linking Google:", error);
      toast.error("La autenticación con Google no está habilitada todavía");
    }
  };

  const unlinkGoogle = async () => {
    if (!google) return;
    const { error } = await supabase.auth.unlinkIdentity(google);
    if (error) {
      console.error("Error unlinking Google:", error);
      toast.error("No se pudo desvincular la cuenta de Google");
      return;
    }
    await supabase.auth.refreshSession();
    toast.success("Cuenta de Google desvinculada");
  };

  return (
    <SettingsSection title="Login" description="Inicia sesión de forma rápida y segura con el método elegido.">
      <div className="divide-y divide-border">
        <MethodRow
          icon={Mail}
          title="Correo electrónico y contraseña"
          description={<>Puedes iniciar sesión con la dirección de correo electrónico {user?.email} y tu contraseña.</>}
        >
          <Button variant="outline" onClick={() => setPasswordOpen(true)}>
            Cambiar mi contraseña
          </Button>
        </MethodRow>
        <MethodRow
          icon={KeyRound}
          title="Autenticación a través de Google"
          description={
            google
              ? `Puedes iniciar sesión con tu cuenta de Google${google.identity_data?.email ? ` (${google.identity_data.email})` : ""}.`
              : "Vincula tu cuenta de Google para iniciar sesión con ella."
          }
        >
          {google ? (
            <>
              <Badge variant="secondary">Vinculada</Badge>
              {identities.length > 1 && (
                <Button variant="ghost" onClick={unlinkGoogle}>
                  Desvincular
                </Button>
              )}
            </>
          ) : (
            <Button variant="outline" onClick={linkGoogle}>
              Iniciar sesión con Google
            </Button>
          )}
        </MethodRow>
      </div>
      <CambiarContrasenaDialog open={passwordOpen} onOpenChange={setPasswordOpen} />
    </SettingsSection>
  );
}

function DobleFactor() {
  const { refreshMfaStatus } = useAuth();
  const [factors, setFactors] = useState<Factor[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState<{ factorId: string; qrCode: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [removing, setRemoving] = useState<Factor | null>(null);

  const fetchFactors = async () => {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) console.error("Error listing MFA factors:", error);
    setFactors(data?.totp ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchFactors();
  }, []);

  const totp = factors.find((f) => f.status === "verified");

  const startEnroll = async () => {
    // Limpia intentos anteriores que se quedaron sin verificar
    const { data: all } = await supabase.auth.mfa.listFactors();
    for (const f of all?.all ?? []) {
      if (f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
    }

    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Aplicación de autenticación",
    });
    if (error || !data) {
      console.error("Error enrolling TOTP:", error);
      toast.error("No se pudo iniciar la configuración del doble factor");
      return;
    }
    setCode("");
    setEnrolling({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret });
  };

  const cancelEnroll = async () => {
    if (enrolling) await supabase.auth.mfa.unenroll({ factorId: enrolling.factorId });
    setEnrolling(null);
  };

  const verifyEnroll = async () => {
    if (!enrolling) return;
    setVerifying(true);
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: enrolling.factorId, code: code.trim() });
    setVerifying(false);

    if (error) {
      toast.error("Código incorrecto, inténtalo de nuevo");
      return;
    }
    toast.success("Autenticación de doble factor activada");
    setEnrolling(null);
    await fetchFactors();
    await refreshMfaStatus();
  };

  const confirmRemove = async () => {
    if (!removing) return;
    const { error } = await supabase.auth.mfa.unenroll({ factorId: removing.id });
    if (error) {
      console.error("Error removing MFA factor:", error);
      toast.error("No se pudo eliminar el método de autenticación");
      return;
    }
    await supabase.auth.refreshSession();
    toast.success("Autenticación de doble factor desactivada");
    setRemoving(null);
    await fetchFactors();
    await refreshMfaStatus();
  };

  return (
    <SettingsSection
      title="Autenticación de doble factor (2FA)"
      description="Añade una capa adicional de seguridad para proteger tu cuenta si te roban tu contraseña. Después de configurar esta función, necesitarás un código de verificación además de tu contraseña cuando inicies sesión."
    >
      {loading ? null : (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            {totp ? (
              <>
                <ShieldCheck className="w-4 h-4 text-green-600" />
                Protección activada
              </>
            ) : (
              <>
                <ShieldOff className="w-4 h-4 text-muted-foreground" />
                Protección desactivada
              </>
            )}
          </div>

          <div>
            <p className="text-sm text-muted-foreground mb-3">Métodos de autenticación disponibles</p>
            <div className="divide-y divide-border rounded-lg border border-border px-4 py-4">
              <MethodRow
                icon={Smartphone}
                title="Contraseña de un solo uso"
                description="Se generará un código único temporal en una aplicación móvil dedicada (como Google Authenticator)."
              >
                {totp ? (
                  <>
                    <Badge variant="secondary">Activado</Badge>
                    <Button variant="ghost" onClick={() => setRemoving(totp)}>
                      Eliminar
                    </Button>
                  </>
                ) : (
                  <Button variant="outline" onClick={startEnroll}>
                    Activar
                  </Button>
                )}
              </MethodRow>
              <MethodRow icon={MessageSquare} title="SMS" description="Recibe el código de verificación por SMS en tu teléfono.">
                <Badge variant="outline">Próximamente</Badge>
              </MethodRow>
            </div>
          </div>
        </div>
      )}

      <Dialog open={!!enrolling} onOpenChange={(open) => !open && cancelEnroll()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Activar la contraseña de un solo uso</DialogTitle>
            <DialogDescription>
              Escanea el código QR con tu aplicación de autenticación e introduce el código de 6 dígitos que te muestre.
            </DialogDescription>
          </DialogHeader>
          {enrolling && (
            <div className="space-y-4">
              <img src={enrolling.qrCode} alt="Código QR para la aplicación de autenticación" className="mx-auto h-44 w-44 rounded-md bg-white p-2" />
              <p className="text-xs text-muted-foreground text-center break-all">
                ¿No puedes escanearlo? Introduce esta clave: <span className="font-mono text-foreground">{enrolling.secret}</span>
              </p>
              <div className="space-y-2">
                <Label htmlFor="codigo_totp">Código de verificación</Label>
                <Input
                  id="codigo_totp"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={cancelEnroll} disabled={verifying}>
              Cancelar
            </Button>
            <Button onClick={verifyEnroll} disabled={verifying || code.length !== 6}>
              {verifying ? "Verificando..." : "Activar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!removing} onOpenChange={(open) => !open && setRemoving(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>¿Desactivar el doble factor?</DialogTitle>
            <DialogDescription>
              Tu cuenta quedará protegida solo por la contraseña.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoving(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmRemove}>
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SettingsSection>
  );
}

export function InicioSesionTab() {
  return (
    <div className="space-y-6">
      <CorreoInicioSesion />
      <MetodosLogin />
      <DobleFactor />
    </div>
  );
}
