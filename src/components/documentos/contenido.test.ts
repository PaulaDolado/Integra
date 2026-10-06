import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { getSchema } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Node as NodoPM } from "@tiptap/pm/model";
import { CAMPO_CONTENIDO, enlaceSeguro, indiceDeNota, marcadorDeEnlace, normalizarEnlace, textoDeDocumento } from "./contenido";
import { Marcador } from "./extensiones";
import { clasePapel, colorDePersona, filtrarNotas, puedeEditar, tituloNota, type NotaResumen } from "./notas";
import { problemaImagen } from "./imagenes";

describe("enlaces", () => {
  it("solo admite web, correo, teléfono y marcadores de la nota", () => {
    expect(enlaceSeguro("https://integra.example.com/a?b=1")).toBe(true);
    expect(enlaceSeguro("http://intranet")).toBe(true);
    expect(enlaceSeguro("mailto:rrhh@empresa.com")).toBe(true);
    expect(enlaceSeguro("tel:+34600000000")).toBe(true);
    expect(enlaceSeguro("#marcador-1a2b3c4d")).toBe(true);
  });

  it("rechaza javascript:, data: y similares, también disfrazados", () => {
    expect(enlaceSeguro("javascript:alert(1)")).toBe(false);
    expect(enlaceSeguro(" JavaScript:alert(1)")).toBe(false);
    expect(enlaceSeguro("data:text/html,<script>alert(1)</script>")).toBe(false);
    expect(enlaceSeguro("vbscript:msgbox")).toBe(false);
    expect(enlaceSeguro("file:///etc/passwd")).toBe(false);
    expect(enlaceSeguro("#marcador-x\" onclick=\"alert(1)")).toBe(false);
    expect(enlaceSeguro("integra.example.com")).toBe(false);
  });

  it("completa lo que escribe la gente", () => {
    expect(normalizarEnlace("integra.example.com")).toBe("https://integra.example.com");
    expect(normalizarEnlace("  rrhh@empresa.com ")).toBe("mailto:rrhh@empresa.com");
    expect(normalizarEnlace("http://a.b")).toBe("http://a.b");
    expect(normalizarEnlace("#marcador-abc")).toBe("#marcador-abc");
    // No convierte un esquema peligroso en uno válido
    expect(enlaceSeguro(normalizarEnlace("javascript:alert(1)"))).toBe(false);
  });

  it("reconoce los enlaces a marcadores", () => {
    expect(marcadorDeEnlace("#marcador-abc123")).toBe("abc123");
    expect(marcadorDeEnlace("https://a.b/#marcador-abc")).toBeNull();
  });
});

describe("textoDeDocumento", () => {
  it("saca el texto plano de los párrafos para el extracto", () => {
    const doc = new Y.Doc();
    const fragmento = doc.getXmlFragment(CAMPO_CONTENIDO);
    // Como lo guarda el editor: cada bloque es un elemento con su texto (y sus marcas)
    fragmento.insert(0, [new Y.XmlElement("heading"), new Y.XmlElement("paragraph")]);
    const [titulo, parrafo] = fragmento.toArray() as Y.XmlElement[];
    titulo.insert(0, [new Y.XmlText()]);
    parrafo.insert(0, [new Y.XmlText()]);
    (titulo.get(0) as Y.XmlText).insert(0, "Acta");
    const texto = parrafo.get(0) as Y.XmlText;
    texto.insert(0, "Asistentes:  Ana");
    texto.insert(texto.length, " y Luis", { bold: {} });

    expect(textoDeDocumento(doc)).toBe("Acta Asistentes: Ana y Luis");
    expect(textoDeDocumento(doc, 8)).toBe("Acta Asi");
  });

  it("devuelve vacío con la nota en blanco", () => {
    expect(textoDeDocumento(new Y.Doc())).toBe("");
  });
});

describe("indiceDeNota", () => {
  it("lista marcadores y títulos en orden, sin los títulos vacíos", () => {
    const schema = getSchema([StarterKit, Marcador]);
    const doc = NodoPM.fromJSON(schema, {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Introducción" }] },
        { type: "paragraph", content: [{ type: "text", text: "Texto " }, { type: "marcador", attrs: { id: "m1", nombre: "Presupuesto" } }] },
        { type: "heading", attrs: { level: 2 } },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Detalle" }] },
      ],
    });

    expect(indiceDeNota(doc).map(({ tipo, texto, nivel }) => ({ tipo, texto, nivel }))).toEqual([
      { tipo: "titulo", texto: "Introducción", nivel: 1 },
      { tipo: "marcador", texto: "Presupuesto", nivel: 0 },
      { tipo: "titulo", texto: "Detalle", nivel: 2 },
    ]);
  });
});

describe("notas", () => {
  const nota = (datos: Partial<NotaResumen>): NotaResumen => ({
    id: "n",
    titulo: "",
    formato: "blanco",
    extracto: "",
    mi_rol: "propietario",
    propietario_id: "e1",
    propietario_nombre: "Ana López",
    colaboradores: 0,
    actualizado_por_nombre: null,
    created_at: "2026-10-01T09:00:00Z",
    updated_at: "2026-10-01T09:00:00Z",
    ...datos,
  });

  it("filtra por propias, compartidas y texto", () => {
    const notas = [
      nota({ id: "1", titulo: "Acta", mi_rol: "propietario" }),
      nota({ id: "2", titulo: "Ideas", mi_rol: "editor", propietario_nombre: "Luis Pérez" }),
      nota({ id: "3", extracto: "presupuesto del trimestre", mi_rol: "lector" }),
    ];
    expect(filtrarNotas(notas, "mias", "").map((n) => n.id)).toEqual(["1"]);
    expect(filtrarNotas(notas, "compartidas", "").map((n) => n.id)).toEqual(["2", "3"]);
    expect(filtrarNotas(notas, "todas", "luis").map((n) => n.id)).toEqual(["2"]);
    expect(filtrarNotas(notas, "todas", "PRESUPUESTO").map((n) => n.id)).toEqual(["3"]);
  });

  it("usa un fondo conocido aunque llegue un formato raro", () => {
    expect(clasePapel("rayas")).toBe("papel-nota papel-rayas");
    expect(clasePapel("<script>")).toBe("papel-nota papel-blanco");
  });

  it("cada persona tiene siempre el mismo color", () => {
    expect(colorDePersona("e1")).toBe(colorDePersona("e1"));
    expect(colorDePersona("e1")).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("solo el propietario y los editores pueden editar", () => {
    expect(puedeEditar("propietario")).toBe(true);
    expect(puedeEditar("editor")).toBe(true);
    expect(puedeEditar("lector")).toBe(false);
    expect(puedeEditar(null)).toBe(false);
  });

  it("las notas sin título se llaman «Sin título»", () => {
    expect(tituloNota("  ")).toBe("Sin título");
    expect(tituloNota(" Acta ")).toBe("Acta");
  });
});

describe("imágenes", () => {
  const archivo = (tipo: string, bytes: number) => new File([new Uint8Array(bytes)], "foto", { type: tipo });

  it("admite PNG, JPG, WEBP y GIF de hasta 5 MB", () => {
    expect(problemaImagen(archivo("image/png", 1000))).toBeNull();
    expect(problemaImagen(archivo("image/webp", 5 * 1024 * 1024))).toBeNull();
  });

  it("rechaza otros tipos (también SVG) y las que pesan demasiado", () => {
    expect(problemaImagen(archivo("image/svg+xml", 100))).toMatch(/solo se admiten/);
    expect(problemaImagen(archivo("application/pdf", 100))).toMatch(/solo se admiten/);
    expect(problemaImagen(archivo("image/png", 5 * 1024 * 1024 + 1))).toMatch(/5 MB/);
  });
});
