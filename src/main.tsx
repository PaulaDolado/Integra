import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Evita que otra web muestre Integra dentro de un iframe (clickjacking).
// GitHub Pages no permite enviar la cabecera X-Frame-Options, así que se hace aquí.
const isFramed = (() => {
  try {
    return window.self !== window.top;
  } catch {
    // Si no se puede leer window.top, el marco es de otro origen
    return true;
  }
})();

if (isFramed) {
  try {
    window.top!.location.href = window.location.href;
  } catch {
    document.body.textContent = "Integra no se puede mostrar dentro de otra página.";
  }
} else {
  createRoot(document.getElementById("root")!).render(<App />);
}
