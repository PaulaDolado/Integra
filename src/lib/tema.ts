// Modo oscuro recordado en el navegador. Sin preferencia guardada se sigue la del sistema.
const CLAVE = "integra:tema";

export type Tema = "claro" | "oscuro";

export function temaInicial(): Tema {
  try {
    const guardado = localStorage.getItem(CLAVE);
    if (guardado === "claro" || guardado === "oscuro") return guardado;
  } catch {
    // Almacenamiento bloqueado: se usa la preferencia del sistema
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "oscuro" : "claro";
}

export function aplicarTema(tema: Tema) {
  document.documentElement.classList.toggle("dark", tema === "oscuro");
}

export function guardarTema(tema: Tema) {
  aplicarTema(tema);
  try {
    localStorage.setItem(CLAVE, tema);
  } catch {
    // Sin almacenamiento el cambio dura solo esta visita
  }
}
