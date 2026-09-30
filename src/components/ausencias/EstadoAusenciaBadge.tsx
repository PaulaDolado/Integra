import { Badge } from "@/components/ui/badge";

export function EstadoAusenciaBadge({ estado }: { estado: string }) {
  switch (estado) {
    case "pendiente":
      return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">Pendiente</Badge>;
    case "aprobada":
      return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">Aprobada</Badge>;
    case "rechazada":
      return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">Rechazada</Badge>;
    default:
      return <Badge variant="outline">{estado}</Badge>;
  }
}
