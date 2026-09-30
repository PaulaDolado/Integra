import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { User, Lock, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router";
import { supabase } from "@/integrations/supabase/client";
import { appUrl } from "@/lib/app-url";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [isResetting, setIsResetting] = useState(false);
  const { toast } = useToast();
  const [mfaCode, setMfaCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const { signIn, signOut, user, mfaPending, refreshMfaStatus } = useAuth();
  const navigate = useNavigate();

  // Redirect if already logged in
  useEffect(() => {
    if (user && !mfaPending) {
      navigate("/dashboard");
    }
  }, [user, mfaPending, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { error } = await signIn(email, password);
      
      if (error) {
        toast({
          title: "Error de autenticación",
          description: error.message === "Invalid login credentials" 
            ? "Credenciales incorrectas" 
            : error.message,
          variant: "destructive",
        });
      } else {
        // Con doble factor activo, el useEffect espera a que se verifique el código
        await refreshMfaStatus();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Ocurrió un error inesperado",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsVerifying(true);

    try {
      const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
      if (factorsError) throw factorsError;

      const factor = factors.totp[0];
      if (!factor) throw new Error("No hay ningún método de doble factor configurado");

      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: factor.id,
        code: mfaCode.trim(),
      });
      if (error) throw error;

      setMfaCode("");
      await refreshMfaStatus();
    } catch (error) {
      toast({
        title: "Código incorrecto",
        description: "Revisa el código de tu aplicación de autenticación e inténtalo de nuevo",
        variant: "destructive",
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleCancelMfa = async () => {
    setMfaCode("");
    await signOut();
  };

  const handleGoogleSignIn = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: appUrl("/dashboard") },
    });

    if (error) {
      toast({
        title: "Error",
        description: "El inicio de sesión con Google no está disponible",
        variant: "destructive",
      });
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsResetting(true);

    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: appUrl("/reset-password"),
      });

      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Email enviado",
          description: "Revisa tu correo para restablecer tu contraseña",
        });
        setShowResetPassword(false);
        setResetEmail("");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Ocurrió un error al enviar el correo",
        variant: "destructive",
      });
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-secondary/5 p-4">
      <Card className="w-full max-w-md bg-card/80 backdrop-blur-sm shadow-lg">
        <CardHeader className="space-y-6 pb-8">
          {/* Company Logo */}
          <div className="flex justify-center">
            <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center shadow-lg">
              <div className="w-12 h-12 bg-background rounded-lg flex items-center justify-center">
                <span className="text-2xl font-bold text-primary">I</span>
              </div>
            </div>
          </div>
          
          {/* Company Name */}
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold text-foreground">Integra</h1>
            <p className="text-muted-foreground text-sm">Inicia sesión en tu cuenta</p>
          </div>
        </CardHeader>

        <CardContent>
          {user && mfaPending ? (
            <form onSubmit={handleVerifyMfa} className="space-y-6">
              <div className="space-y-2 text-center">
                <ShieldCheck className="w-8 h-8 mx-auto text-primary" />
                <h3 className="text-lg font-semibold text-foreground">
                  Verificación en dos pasos
                </h3>
                <p className="text-sm text-muted-foreground">
                  Introduce el código de 6 dígitos de tu aplicación de autenticación
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="mfa-code" className="text-foreground font-medium">
                  Código de verificación
                </Label>
                <Input
                  id="mfa-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="123456"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value.replace(/D/g, ""))}
                  required
                  autoFocus
                />
              </div>

              <Button type="submit" disabled={isVerifying || mfaCode.length !== 6} className="w-full">
                {isVerifying ? "Verificando..." : "Verificar"}
              </Button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={handleCancelMfa}
                  className="text-sm text-primary hover:underline"
                >
                  Volver al inicio de sesión
                </button>
              </div>
            </form>
          ) : !showResetPassword ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Email Field */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-foreground font-medium">
                  Correo electrónico
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="Ingrese su correo electrónico"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-2">
                <Label htmlFor="password" className="text-foreground font-medium">
                  Contraseña
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Ingrese su contraseña"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Login Button */}
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin"></div>
                    <span>Iniciando sesión...</span>
                  </div>
                ) : (
                  "Iniciar Sesión"
                )}
              </Button>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleGoogleSignIn}
              >
                Continuar con Google
              </Button>

              {/* Forgot Password Link */}
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setShowResetPassword(true)}
                  className="text-sm text-primary hover:underline"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-6">
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-foreground text-center">
                  Recuperar Contraseña
                </h3>
                <p className="text-sm text-muted-foreground text-center">
                  Ingresa tu correo electrónico y te enviaremos un enlace para restablecer tu contraseña
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reset-email" className="text-foreground font-medium">
                  Correo electrónico
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    id="reset-email"
                    type="email"
                    placeholder="Ingrese su correo electrónico"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={isResetting}
                className="w-full"
              >
                {isResetting ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin"></div>
                    <span>Enviando...</span>
                  </div>
                ) : (
                  "Enviar Enlace de Recuperación"
                )}
              </Button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setShowResetPassword(false);
                    setResetEmail("");
                  }}
                  className="text-sm text-primary hover:underline"
                >
                  Volver al inicio de sesión
                </button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}