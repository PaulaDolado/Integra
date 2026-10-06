import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Bookmark,
  Code,
  Highlighter,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Palette,
  Quote,
  Redo2,
  RemoveFormatting,
  Sigma,
  SquareCode,
  Strikethrough,
  Subscript as IconoSubindice,
  Superscript as IconoSuperindice,
  Table as IconoTabla,
  Underline,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const COLORES_TEXTO = [
  { nombre: "Automático", valor: null },
  { nombre: "Gris", valor: "#6b7280" },
  { nombre: "Rojo", valor: "#dc2626" },
  { nombre: "Naranja", valor: "#ea580c" },
  { nombre: "Amarillo", valor: "#ca8a04" },
  { nombre: "Verde", valor: "#16a34a" },
  { nombre: "Azul", valor: "#2563eb" },
  { nombre: "Morado", valor: "#7c3aed" },
  { nombre: "Rosa", valor: "#db2777" },
];

const COLORES_RESALTADO = [
  { nombre: "Sin resaltar", valor: null },
  { nombre: "Amarillo", valor: "#fef08a" },
  { nombre: "Verde", valor: "#bbf7d0" },
  { nombre: "Azul", valor: "#bfdbfe" },
  { nombre: "Rosa", valor: "#fbcfe8" },
  { nombre: "Naranja", valor: "#fed7aa" },
  { nombre: "Morado", valor: "#ddd6fe" },
];

type Bloque = "p" | "1" | "2" | "3";

interface BotonProps {
  icono: LucideIcon;
  etiqueta: string;
  atajo?: string;
  activo?: boolean;
  deshabilitado?: boolean;
  onClick: () => void;
}

function Boton({ icono: Icono, etiqueta, atajo, activo, deshabilitado, onClick }: BotonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      // Sin perder la selección del editor al pulsar
      onMouseDown={(e) => e.preventDefault()}
      disabled={deshabilitado}
      aria-label={etiqueta}
      aria-pressed={activo === undefined ? undefined : activo}
      title={atajo ? `${etiqueta} (${atajo})` : etiqueta}
      className={cn(
        "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors",
        "hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:pointer-events-none disabled:opacity-40",
        activo && "bg-accent text-accent-foreground hover:bg-accent"
      )}
    >
      <Icono className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}

const Separador = () => <span className="mx-1 h-5 w-px shrink-0 bg-border" aria-hidden="true" />;

function SelectorColor({
  icono: Icono,
  etiqueta,
  colores,
  actual,
  onElegir,
}: {
  icono: LucideIcon;
  etiqueta: string;
  colores: { nombre: string; valor: string | null }[];
  actual: string | null;
  onElegir: (valor: string | null) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={etiqueta}
          title={etiqueta}
          className="relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Icono className="h-4 w-4" aria-hidden="true" />
          <span
            className="absolute bottom-1 left-2 right-2 h-0.5 rounded-full"
            style={{ backgroundColor: actual ?? "transparent" }}
            aria-hidden="true"
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-auto p-2">
        <div className="grid grid-cols-5 gap-1.5">
          {colores.map((c) => (
            <DropdownMenuItem
              key={c.nombre}
              onSelect={() => onElegir(c.valor)}
              aria-label={c.nombre}
              title={c.nombre}
              className={cn(
                "h-7 w-7 justify-center rounded-md border border-border p-0",
                actual === c.valor && "ring-2 ring-primary ring-offset-1"
              )}
              style={{ backgroundColor: c.valor ?? undefined }}
            >
              {c.valor === null && <span className="text-xs text-muted-foreground" aria-hidden="true">✕</span>}
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface BarraHerramientasProps {
  editor: Editor;
  onEnlace: () => void;
  onImagen: () => void;
  onEcuacion: () => void;
  onMarcador: () => void;
}

export function BarraHerramientas({ editor, onEnlace, onImagen, onEcuacion, onMarcador }: BarraHerramientasProps) {
  // Solo se vuelve a pintar cuando cambia algo de lo que muestra
  const e = useEditorState({
    editor,
    selector: ({ editor: ed }) => ({
      bloque: (ed.isActive("heading", { level: 1 })
        ? "1"
        : ed.isActive("heading", { level: 2 })
          ? "2"
          : ed.isActive("heading", { level: 3 })
            ? "3"
            : "p") as Bloque,
      negrita: ed.isActive("bold"),
      cursiva: ed.isActive("italic"),
      subrayado: ed.isActive("underline"),
      tachado: ed.isActive("strike"),
      codigo: ed.isActive("code"),
      subindice: ed.isActive("subscript"),
      superindice: ed.isActive("superscript"),
      enlace: ed.isActive("link"),
      color: (ed.getAttributes("textStyle").color as string | undefined) ?? null,
      resaltado: (ed.getAttributes("highlight").color as string | undefined) ?? null,
      izquierda: ed.isActive({ textAlign: "left" }),
      centro: ed.isActive({ textAlign: "center" }),
      derecha: ed.isActive({ textAlign: "right" }),
      justificado: ed.isActive({ textAlign: "justify" }),
      vinetas: ed.isActive("bulletList"),
      numerada: ed.isActive("orderedList"),
      tareas: ed.isActive("taskList"),
      cita: ed.isActive("blockquote"),
      bloqueCodigo: ed.isActive("codeBlock"),
      enTabla: ed.isActive("table"),
      puedeDeshacer: ed.can().undo(),
      puedeRehacer: ed.can().redo(),
    }),
  });
  const cadena = () => editor.chain().focus();

  const cambiarBloque = (valor: string) => {
    if (valor === "p") cadena().setParagraph().run();
    else cadena().toggleHeading({ level: Number(valor) as 1 | 2 | 3 }).run();
  };

  return (
    <div
      role="toolbar"
      aria-label="Formato del texto"
      aria-orientation="horizontal"
      // En el móvil, una sola fila que se desliza; en pantallas grandes, varias filas
      className="-mx-1 flex items-center gap-0.5 overflow-x-auto px-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
    >
      <Boton icono={Undo2} etiqueta="Deshacer" atajo="Ctrl+Z" deshabilitado={!e.puedeDeshacer} onClick={() => cadena().undo().run()} />
      <Boton icono={Redo2} etiqueta="Rehacer" atajo="Ctrl+Y" deshabilitado={!e.puedeRehacer} onClick={() => cadena().redo().run()} />
      <Separador />

      <Select value={e.bloque} onValueChange={cambiarBloque}>
        <SelectTrigger className="h-8 w-32 border-none text-xs shadow-none hover:bg-muted" aria-label="Estilo del párrafo">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="p">Texto normal</SelectItem>
          <SelectItem value="1">Título 1</SelectItem>
          <SelectItem value="2">Título 2</SelectItem>
          <SelectItem value="3">Título 3</SelectItem>
        </SelectContent>
      </Select>
      <Separador />

      <Boton icono={Bold} etiqueta="Negrita" atajo="Ctrl+B" activo={e.negrita} onClick={() => cadena().toggleBold().run()} />
      <Boton icono={Italic} etiqueta="Cursiva" atajo="Ctrl+I" activo={e.cursiva} onClick={() => cadena().toggleItalic().run()} />
      <Boton icono={Underline} etiqueta="Subrayado" atajo="Ctrl+U" activo={e.subrayado} onClick={() => cadena().toggleUnderline().run()} />
      <Boton icono={Strikethrough} etiqueta="Tachado" activo={e.tachado} onClick={() => cadena().toggleStrike().run()} />
      <Boton icono={Code} etiqueta="Código" activo={e.codigo} onClick={() => cadena().toggleCode().run()} />
      <Boton icono={IconoSubindice} etiqueta="Subíndice" activo={e.subindice} onClick={() => cadena().toggleSubscript().run()} />
      <Boton icono={IconoSuperindice} etiqueta="Superíndice" activo={e.superindice} onClick={() => cadena().toggleSuperscript().run()} />
      <SelectorColor
        icono={Palette}
        etiqueta="Color del texto"
        colores={COLORES_TEXTO}
        actual={e.color}
        onElegir={(c) => (c ? cadena().setColor(c).run() : cadena().unsetColor().run())}
      />
      <SelectorColor
        icono={Highlighter}
        etiqueta="Resaltar"
        colores={COLORES_RESALTADO}
        actual={e.resaltado}
        onElegir={(c) => (c ? cadena().setHighlight({ color: c }).run() : cadena().unsetHighlight().run())}
      />
      <Boton icono={RemoveFormatting} etiqueta="Quitar formato" onClick={() => cadena().unsetAllMarks().clearNodes().run()} />
      <Separador />

      <Boton icono={AlignLeft} etiqueta="Alinear a la izquierda" activo={e.izquierda} onClick={() => cadena().setTextAlign("left").run()} />
      <Boton icono={AlignCenter} etiqueta="Centrar" activo={e.centro} onClick={() => cadena().setTextAlign("center").run()} />
      <Boton icono={AlignRight} etiqueta="Alinear a la derecha" activo={e.derecha} onClick={() => cadena().setTextAlign("right").run()} />
      <Boton icono={AlignJustify} etiqueta="Justificar" activo={e.justificado} onClick={() => cadena().setTextAlign("justify").run()} />
      <Separador />

      <Boton icono={List} etiqueta="Lista con viñetas" activo={e.vinetas} onClick={() => cadena().toggleBulletList().run()} />
      <Boton icono={ListOrdered} etiqueta="Lista numerada" activo={e.numerada} onClick={() => cadena().toggleOrderedList().run()} />
      <Boton icono={ListChecks} etiqueta="Lista de tareas" activo={e.tareas} onClick={() => cadena().toggleTaskList().run()} />
      <Boton icono={Quote} etiqueta="Cita" activo={e.cita} onClick={() => cadena().toggleBlockquote().run()} />
      <Boton icono={SquareCode} etiqueta="Bloque de código" activo={e.bloqueCodigo} onClick={() => cadena().toggleCodeBlock().run()} />
      <Boton icono={Minus} etiqueta="Línea separadora" onClick={() => cadena().setHorizontalRule().run()} />
      <Separador />

      <Boton icono={Link2} etiqueta="Enlace" atajo="Ctrl+K" activo={e.enlace} onClick={onEnlace} />
      <Boton icono={ImagePlus} etiqueta="Imagen" onClick={onImagen} />
      <Boton icono={Sigma} etiqueta="Ecuación" onClick={onEcuacion} />
      <Boton icono={Bookmark} etiqueta="Marcador" onClick={onMarcador} />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Tabla"
            title="Tabla"
            className={cn(
              "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              e.enTabla && "bg-accent text-accent-foreground"
            )}
          >
            <IconoTabla className="h-4 w-4" aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {e.enTabla ? (
            <>
              <DropdownMenuItem onSelect={() => cadena().addRowAfter().run()}>Añadir fila debajo</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => cadena().addColumnAfter().run()}>Añadir columna a la derecha</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => cadena().toggleHeaderRow().run()}>Fila de cabecera</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => cadena().deleteRow().run()}>Borrar fila</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => cadena().deleteColumn().run()}>Borrar columna</DropdownMenuItem>
              <DropdownMenuItem className="text-destructive" onSelect={() => cadena().deleteTable().run()}>
                Borrar tabla
              </DropdownMenuItem>
            </>
          ) : (
            <DropdownMenuItem onSelect={() => cadena().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
              Insertar tabla 3 × 3
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
