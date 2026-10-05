import axe, { type Result, type RunOptions } from "axe-core";

// Reglas de axe que no pueden funcionar en jsdom y darían falsos positivos o
// negativos: el contraste necesita los colores calculados de un navegador real
// (jsdom no aplica las hojas de estilo de Tailwind ni calcula el layout), así
// que se revisa a mano en el navegador.
const REGLAS_SIN_JSDOM: RunOptions["rules"] = {
  "color-contrast": { enabled: false },
};

// En los tests de página se pinta la pantalla sin el AppLayout, así que su
// contenido no está dentro de <main>: la regla de regiones solo tiene sentido
// con el layout completo (lo comprueba su propio test con `{ conLayout: true }`)
const REGLAS_SIN_LAYOUT: RunOptions["rules"] = {
  region: { enabled: false },
};

const describir = (violaciones: Result[]) =>
  violaciones
    .map((v) => {
      const nodos = v.nodes.map((n) => `    ${n.target.join(" ")}\n      ${n.failureSummary?.replace(/\n/g, "\n      ")}`);
      return `- [${v.id}] ${v.help} (${v.helpUrl})\n${nodos.join("\n")}`;
    })
    .join("\n");

// Pasa axe sobre lo pintado y falla con la lista de problemas si hay alguno.
// Por defecto revisa todo el documento: los diálogos y menús de Radix se
// montan en portales fuera del contenedor del render.
export async function expectSinViolaciones(
  contenedor: Element = document.body,
  { conLayout = false }: { conLayout?: boolean } = {},
) {
  const rules = conLayout ? REGLAS_SIN_JSDOM : { ...REGLAS_SIN_JSDOM, ...REGLAS_SIN_LAYOUT };
  const resultado = await axe.run(contenedor, { rules, resultTypes: ["violations"] });
  if (resultado.violations.length > 0) {
    throw new Error(`Problemas de accesibilidad:\n${describir(resultado.violations)}`);
  }
}
