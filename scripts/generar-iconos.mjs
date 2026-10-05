// Genera los iconos PNG de la app instalable a partir de public/favicon.svg.
// Los PNG resultantes se guardan en public/ y se suben al repositorio; este
// script solo hace falta si cambia el logotipo: npm run iconos
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const publica = path.resolve(import.meta.dirname, "../public");
const svg = await readFile(path.join(publica, "favicon.svg"), "utf8");

// Versión a sangre (sin esquinas redondeadas): Android recorta los iconos
// «maskable» con la forma del sistema, e iOS redondea por su cuenta y pinta de
// negro lo transparente. La «I» queda dentro del 40 % central, así que cabe
// entera en la zona segura de los iconos maskable sin añadir margen.
const svgASangre = svg.replace(/\s+rx="[^"]*"/, "");
if (svgASangre === svg) throw new Error("favicon.svg ya no tiene el rx del fondo: revisa este script");

const iconos = [
  // Iconos normales: con las esquinas redondeadas y transparentes del favicon
  { archivo: "pwa-192x192.png", origen: svg, lado: 192 },
  { archivo: "pwa-512x512.png", origen: svg, lado: 512 },
  { archivo: "maskable-icon-512x512.png", origen: svgASangre, lado: 512 },
  { archivo: "apple-touch-icon.png", origen: svgASangre, lado: 180 },
];

for (const { archivo, origen, lado } of iconos) {
  // El SVG mide 64x64: se rasteriza al doble del tamaño final y se reduce para que salga nítido
  await sharp(Buffer.from(origen), { density: (72 * lado * 2) / 64 })
    .resize(lado, lado)
    .png({ compressionLevel: 9 })
    .toFile(path.join(publica, archivo));
  console.log(`public/${archivo} (${lado}x${lado})`);
}
