import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import type { Node as NodoPM } from "@tiptap/pm/model";
import { Loader2 } from "lucide-react";
import "katex/dist/katex.min.css";
import "./papel-notas.css";
import "./editor-notas.css";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { crearExtensiones, type UsuarioCursor } from "./extensiones";
import { BarraHerramientas, type Plantilla } from "./BarraHerramientas";
import { cambiarAjuste, useAjustesNota } from "./ajustes";
import { plantillaIndice, plantillaPortada } from "./plantillas";
import { PanelIndice } from "./PanelIndice";
import { irAMarcador } from "./navegacion";
import { DialogoEnlace } from "./DialogoEnlace";
import { DialogoEcuacion, type TipoEcuacion } from "./DialogoEcuacion";
import { DialogoMarcador } from "./DialogoMarcador";
import { contarPaginas, enlaceSeguro, indiceDeNota, marcadorDeEnlace } from "./contenido";
import { problemaImagen, subirImagenNota } from "./imagenes";
import { clasePapel, TIPOS_IMAGEN } from "./notas";
import type { SesionNota } from "./useNotaColaborativa";

interface EditorNotaProps {
  notaId: string;
  sesion: SesionNota;
  editable: boolean;
  formato: string;
  usuario: UsuarioCursor;
  mostrarIndice: boolean;
}

interface EstadoEcuacion {
  latex: string;
  tipo: TipoEcuacion;
  // Posición de la ecuación que se edita; null al insertar una nueva
  pos: number | null;
}

interface ClicEcuacion {
  nodo: NodoPM;
  pos: number;
  tipo: TipoEcuacion;
}

const imagenesDe = (archivos: FileList | null | undefined) =>
  Array.from(archivos ?? []).filter((a) => a.type.startsWith("image/"));

export function EditorNota({ notaId, sesion, editable, formato, usuario, mostrarIndice }: EditorNotaProps) {
  const { toast } = useToast();
  const [enlace, setEnlace] = useState<{ href: string; pedirTexto: boolean } | null>(null);
  const [ecuacion, setEcuacion] = useState<EstadoEcuacion | null>(null);
  const [marcador, setMarcador] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(0);
  const selectorArchivos = useRef<HTMLInputElement>(null);

  // Las extensiones y editorProps se crean una vez con el editor: lo que cambia
  // entre renders se lee de estas referencias
  // Las ecuaciones avisan al pulsarlas con un evento (las extensiones no pueden leer refs)
  const [eventos] = useState(() => new EventTarget());
  const acciones = useRef({
    subir: (_archivos: File[], _pos?: number) => {},
    enlace: () => {},
    marcador: (_id: string) => {},
  });

  const editor = useEditor(
    {
      editable,
      immediatelyRender: true,
      extensions: crearExtensiones({
        doc: sesion.doc,
        awareness: sesion.awareness,
        usuario,
        onEcuacion: (nodo, pos, tipo) => eventos.dispatchEvent(new CustomEvent<ClicEcuacion>("ecuacion", { detail: { nodo, pos, tipo } })),
      }),
      editorProps: {
        attributes: {
          class: "contenido-nota",
          "aria-label": "Contenido de la nota",
          ...(editable ? {} : { "aria-readonly": "true" }),
        },
        handlePaste: (_view, event) => {
          const imagenes = imagenesDe(event.clipboardData?.files);
          if (imagenes.length === 0) return false;
          acciones.current.subir(imagenes);
          return true;
        },
        handleDrop: (view, event, _slice, movido) => {
          const imagenes = imagenesDe(event.dataTransfer?.files);
          if (movido || imagenes.length === 0) return false;
          const destino = view.posAtCoords({ left: event.clientX, top: event.clientY });
          acciones.current.subir(imagenes, destino?.pos);
          return true;
        },
        handleClick: (view, _pos, event) => {
          const a = (event.target as HTMLElement | null)?.closest("a");
          const href = a?.getAttribute("href");
          if (!href) return false;
          const idMarcador = marcadorDeEnlace(href);
          if (idMarcador) {
            acciones.current.marcador(idMarcador);
            return true;
          }
          // Editando, un clic pone el cursor; con Ctrl (o en solo lectura) se abre
          if ((!view.editable || event.ctrlKey || event.metaKey) && enlaceSeguro(href)) {
            window.open(href, "_blank", "noopener,noreferrer");
            return true;
          }
          return false;
        },
        handleKeyDown: (_view, event) => {
          if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
            event.preventDefault();
            acciones.current.enlace();
            return true;
          }
          return false;
        },
      },
    },
    [sesion.doc]
  );

  // El nombre puede llegar después (cuando carga el perfil): se actualiza el cursor
  useEffect(() => {
    editor.commands.updateUser({ id: usuario.id, name: usuario.name, color: usuario.color });
  }, [editor, usuario.id, usuario.name, usuario.color]);

  // El permiso puede cambiar sin rehacer el editor
  useEffect(() => {
    if (editor.isEditable !== editable) editor.setEditable(editable);
  }, [editor, editable]);

  const palabras = useEditorState({ editor, selector: ({ editor: ed }) => ed.storage.characterCount.words() as number });
  const paginas = useEditorState({ editor, selector: ({ editor: ed }) => contarPaginas(ed.state.doc) });
  const { numerarPaginas } = useAjustesNota(sesion.doc);

  // La portada va siempre al principio; el índice, donde esté el cursor (o
  // detrás de la portada, si se insertan juntos)
  const insertarPlantilla = (plantilla: Plantilla) => {
    const portada = plantillaPortada({ autor: usuario.name });
    if (plantilla === "portada") editor.chain().focus().insertContentAt(0, portada).run();
    else if (plantilla === "indice") editor.chain().focus().insertContent(plantillaIndice()).run();
    else editor.chain().focus().insertContentAt(0, [...portada, ...plantillaIndice()]).run();
  };

  const subir = async (archivos: File[], pos?: number) => {
    if (!editable) return;
    for (const archivo of archivos) {
      const problema = problemaImagen(archivo);
      if (problema) {
        toast({ title: "Imagen no admitida", description: problema, variant: "destructive" });
        continue;
      }
      setSubiendo((n) => n + 1);
      try {
        const ruta = await subirImagenNota(notaId, archivo);
        const atributos = { ruta, alt: archivo.name.replace(/\.[^.]+$/, "") };
        if (pos !== undefined) editor.chain().focus().insertContentAt(pos, { type: "imagenNota", attrs: atributos }).run();
        else editor.chain().focus().insertarImagenNota(atributos).run();
      } catch (error) {
        console.error("Error subiendo la imagen de la nota", error);
        toast({ title: "Error", description: `No se pudo subir ${archivo.name}`, variant: "destructive" });
      } finally {
        setSubiendo((n) => n - 1);
      }
    }
  };

  const abrirEnlace = () => {
    if (!editable) return;
    const href = (editor.getAttributes("link").href as string | undefined) ?? "";
    setEnlace({ href, pedirTexto: editor.state.selection.empty && !href });
  };

  useEffect(() => {
    acciones.current = {
      subir: (archivos, pos) => void subir(archivos, pos),
      enlace: abrirEnlace,
      marcador: (id) => irAMarcador(editor, id),
    };
  });

  useEffect(() => {
    const alPulsar = (e: Event) => {
      const { nodo, pos, tipo } = (e as CustomEvent<ClicEcuacion>).detail;
      if (editor.isEditable) setEcuacion({ latex: String(nodo.attrs.latex ?? ""), tipo, pos });
    };
    eventos.addEventListener("ecuacion", alPulsar);
    return () => eventos.removeEventListener("ecuacion", alPulsar);
  }, [eventos, editor]);

  const devolverFoco = () => editor.commands.focus();

  const guardarEnlace = (href: string, texto: string) => {
    if (enlace?.pedirTexto) {
      // Lo que se escriba después ya no forma parte del enlace
      editor
        .chain()
        .focus()
        .insertContent({ type: "text", text: texto, marks: [{ type: "link", attrs: { href } }] })
        .unsetMark("link")
        .run();
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    }
    setEnlace(null);
  };

  const guardarEcuacion = (latex: string, tipo: TipoEcuacion) => {
    const c = editor.chain().focus();
    if (ecuacion?.pos != null) {
      if (tipo === "bloque") c.updateBlockMath({ latex, pos: ecuacion.pos }).run();
      else c.updateInlineMath({ latex, pos: ecuacion.pos }).run();
    } else if (tipo === "bloque") {
      c.insertBlockMath({ latex }).run();
    } else {
      c.insertInlineMath({ latex }).run();
    }
    setEcuacion(null);
  };

  const borrarEcuacion = () => {
    if (ecuacion?.pos == null) return;
    const c = editor.chain().focus();
    if (ecuacion.tipo === "bloque") c.deleteBlockMath({ pos: ecuacion.pos }).run();
    else c.deleteInlineMath({ pos: ecuacion.pos }).run();
    setEcuacion(null);
  };

  const abrirMarcador = () => {
    const { from, to } = editor.state.selection;
    setMarcador(editor.state.doc.textBetween(from, to, " ").trim().slice(0, 80));
  };

  const guardarMarcador = (nombre: string) => {
    const { to } = editor.state.selection;
    // El marcador va al final de la selección, sin borrar el texto marcado
    editor.chain().focus().setTextSelection(to).insertarMarcador(nombre).run();
    setMarcador(null);
  };

  const marcadores = enlace ? indiceDeNota(editor.state.doc).filter((e) => e.tipo === "marcador") : [];

  return (
    <div className="flex flex-col">
      {editable && (
        <div className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 py-1.5 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-6">
          <BarraHerramientas
            editor={editor}
            onEnlace={abrirEnlace}
            onImagen={() => selectorArchivos.current?.click()}
            onEcuacion={() => setEcuacion({ latex: "", tipo: "inline", pos: null })}
            onMarcador={abrirMarcador}
            onPlantilla={insertarPlantilla}
            numerarPaginas={numerarPaginas}
            onNumerarPaginas={(numerar) => cambiarAjuste(sesion.doc, "numerarPaginas", numerar)}
          />
          <input
            ref={selectorArchivos}
            type="file"
            accept={TIPOS_IMAGEN.join(",")}
            multiple
            className="hidden"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => {
              const archivos = imagenesDe(e.target.files);
              e.target.value = "";
              void subir(archivos);
            }}
          />
        </div>
      )}

      <div className="flex justify-center gap-6 px-3 py-6 sm:px-6">
        <div className="w-full max-w-[816px] min-w-0">
          <article
            className={cn(clasePapel(formato), numerarPaginas && "numerar-paginas", "rounded-sm border border-border shadow-md")}
          >
            <EditorContent editor={editor} />
            {numerarPaginas && <p className="pie-pagina">Página {paginas}</p>}
          </article>
          <p className="mt-3 flex items-center justify-end gap-3 text-xs text-muted-foreground" aria-live="polite">
            {subiendo > 0 && (
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                Subiendo {subiendo === 1 ? "imagen" : `${subiendo} imágenes`}…
              </span>
            )}
            <span>
              {palabras} {palabras === 1 ? "palabra" : "palabras"}
            </span>
          </p>
        </div>

        {mostrarIndice && (
          <aside className="sticky top-16 hidden h-fit w-56 shrink-0 xl:block">
            <PanelIndice editor={editor} />
          </aside>
        )}
      </div>

      <DialogoEnlace
        onCerrado={devolverFoco}
        open={enlace !== null}
        hrefInicial={enlace?.href ?? ""}
        pedirTexto={enlace?.pedirTexto ?? false}
        marcadores={marcadores}
        onCancel={() => setEnlace(null)}
        onGuardar={guardarEnlace}
        onQuitar={() => {
          editor.chain().focus().extendMarkRange("link").unsetLink().run();
          setEnlace(null);
        }}
      />
      <DialogoEcuacion
        onCerrado={devolverFoco}
        open={ecuacion !== null}
        latexInicial={ecuacion?.latex ?? ""}
        tipoInicial={ecuacion?.tipo ?? "inline"}
        editando={ecuacion?.pos != null}
        onCancel={() => setEcuacion(null)}
        onGuardar={guardarEcuacion}
        onBorrar={borrarEcuacion}
      />
      <DialogoMarcador
        onCerrado={devolverFoco}
        open={marcador !== null}
        nombreInicial={marcador ?? ""}
        onCancel={() => setMarcador(null)}
        onGuardar={guardarMarcador}
      />
    </div>
  );
}
