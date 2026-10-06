import { describe, expect, it } from "vitest";
import {
  ALCANCES,
  cifrarToken,
  claveTokens,
  codeChallenge,
  descifrarToken,
  emailDelIdToken,
  normalizarEvento,
  textoPlano,
  urlAutorizacion,
  volverPermitido,
} from "./google.ts";

const APP = "https://pauladolado.github.io/Integra/";

describe("URL de autorización", () => {
  it("pide solo lectura de eventos, acceso offline y usa PKCE", () => {
    const url = new URL(
      urlAutorizacion({ clientId: "cliente", redirectUri: "https://x.supabase.co/functions/v1/google-calendar/callback", estado: "e", challenge: "c" })
    );
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    const p = url.searchParams;
    expect(p.get("scope")).toBe(ALCANCES.join(" "));
    expect(p.get("scope")).toContain("calendar.events.readonly");
    expect(p.get("scope")).not.toMatch(/calendar(\s|$)|calendar\.events(\s|$)/); // nada de escritura
    expect(p.get("access_type")).toBe("offline");
    expect(p.get("prompt")).toBe("consent");
    expect(p.get("code_challenge_method")).toBe("S256");
    expect(p.get("state")).toBe("e");
  });

  it("el challenge es el SHA-256 en base64url del verificador (ejemplo del RFC 7636)", async () => {
    expect(await codeChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });
});

describe("página de vuelta", () => {
  it("solo permite /google-callback de la propia app o de localhost", () => {
    expect(volverPermitido(`${APP}google-callback`, APP)).toBe(true);
    expect(volverPermitido("http://localhost:8080/google-callback", APP)).toBe(true);
    expect(volverPermitido(`${APP}calendario`, APP)).toBe(false);
    expect(volverPermitido(`${APP}google-callback?x=1`, APP)).toBe(false);
    expect(volverPermitido("https://pauladolado.github.io/otra-web/google-callback", APP)).toBe(false);
    expect(volverPermitido("https://malicioso.example/Integra/google-callback", APP)).toBe(false);
    expect(volverPermitido("http://pauladolado.github.io/Integra/google-callback", APP)).toBe(false);
    expect(volverPermitido("javascript:alert(1)", APP)).toBe(false);
    expect(volverPermitido(`${APP}google-callback`, undefined)).toBe(false);
  });
});

describe("cifrado de los tokens", () => {
  const CLAVE = btoa(String.fromCharCode(...new Uint8Array(32).map((_, i) => i)));

  it("cifra y descifra, con un IV distinto cada vez", async () => {
    const k = await claveTokens(CLAVE);
    const a = await cifrarToken(k, "1//refresh-token");
    const b = await cifrarToken(k, "1//refresh-token");
    expect(a).not.toBe(b);
    expect(a).not.toContain("refresh");
    expect(await descifrarToken(k, a)).toBe("1//refresh-token");
  });

  it("con otra clave no se puede descifrar", async () => {
    const k = await claveTokens(CLAVE);
    const otra = await claveTokens(btoa(String.fromCharCode(...new Uint8Array(32).fill(7))));
    await expect(descifrarToken(otra, await cifrarToken(k, "secreto"))).rejects.toThrow();
  });

  it("exige una clave de 32 bytes", async () => {
    await expect(claveTokens(btoa("corta"))).rejects.toThrow(/32 bytes/);
  });
});

describe("eventos de Google", () => {
  it("convierte un evento con hora", () => {
    expect(
      normalizarEvento({
        id: "g1",
        summary: " Reunión con cliente ",
        location: "Google Meet",
        htmlLink: "https://www.google.com/calendar/event?eid=abc",
        start: { dateTime: "2026-10-08T10:00:00+02:00" },
        end: { dateTime: "2026-10-08T11:00:00+02:00" },
      })
    ).toEqual({
      id: "g1",
      titulo: "Reunión con cliente",
      descripcion: null,
      ubicacion: "Google Meet",
      fecha_inicio: "2026-10-08T08:00:00.000Z",
      fecha_fin: "2026-10-08T09:00:00.000Z",
      todo_el_dia: false,
      ocupado: true,
      enlace: "https://www.google.com/calendar/event?eid=abc",
    });
  });

  it("los de todo el día van de medianoche a medianoche en hora de Madrid", () => {
    const e = normalizarEvento({ id: "g2", summary: "Vacaciones", start: { date: "2026-10-12" }, end: { date: "2026-10-13" } });
    expect(e?.todo_el_dia).toBe(true);
    expect(e?.fecha_inicio).toBe("2026-10-11T22:00:00.000Z"); // 00:00 en Madrid (horario de verano)
    expect(e?.fecha_fin).toBe("2026-10-12T22:00:00.000Z");
    // En invierno el desfase es de una hora
    expect(normalizarEvento({ id: "g3", start: { date: "2026-12-01" }, end: { date: "2026-12-02" } })?.fecha_inicio).toBe(
      "2026-11-30T23:00:00.000Z"
    );
  });

  it("los «Disponible» no ocupan tiempo, los cancelados se descartan y sin título se dice", () => {
    const base = { start: { dateTime: "2026-10-08T10:00:00Z" }, end: { dateTime: "2026-10-08T11:00:00Z" } };
    expect(normalizarEvento({ id: "a", ...base, transparency: "transparent" })?.ocupado).toBe(false);
    expect(normalizarEvento({ id: "b", ...base, status: "cancelled" })).toBeNull();
    expect(normalizarEvento({ id: "c", ...base })?.titulo).toBe("(Sin título)");
    expect(normalizarEvento({ id: "d" })).toBeNull();
  });

  it("deja la descripción en texto plano", () => {
    expect(textoPlano("Hola<br>Agenda:<ul><li>Uno</li><li>Dos &amp; tres</li></ul><b>Fin</b>")).toBe("Hola\nAgenda:Uno\nDos & tres\nFin");
  });
});

describe("id_token", () => {
  it("saca el correo de la carga del token", () => {
    const carga = btoa(JSON.stringify({ email: "laura@empresa.test" })).replace(/=+$/, "");
    expect(emailDelIdToken(`cabecera.${carga}.firma`)).toBe("laura@empresa.test");
    expect(emailDelIdToken("no-es-un-token")).toBeNull();
    expect(emailDelIdToken(undefined)).toBeNull();
  });
});
