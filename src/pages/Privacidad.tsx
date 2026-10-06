import { Link } from "react-router";
import { ArrowLeft } from "lucide-react";

// Quién responde de los datos y cómo contactar. Google comprueba que la política
// de privacidad los incluya al verificar la app.
const RESPONSABLE = "Paula Dolado";
const CONTACTO = "integracontactapp@gmail.com";
const ACTUALIZADA = "6 de octubre de 2026";

const POLITICA_GOOGLE = "https://developers.google.com/terms/api-services-user-data-policy";

// Política de privacidad pública (sin iniciar sesión): la enlazan la pantalla de
// inicio de sesión y la de permisos de Google
export default function Privacidad() {
  return (
    <main className="min-h-screen bg-background">
      <article className="mx-auto max-w-3xl space-y-6 px-4 py-10 text-sm leading-relaxed text-foreground sm:px-6">
        <Link to="/login" className="inline-flex items-center gap-1.5 text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Volver a Integra
        </Link>

        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Política de privacidad de Integra</h1>
          <p className="text-muted-foreground">Última actualización: {ACTUALIZADA}</p>
        </header>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Qué es Integra</h2>
          <p>
            Integra es un portal del empleado desarrollado por {RESPONSABLE} como proyecto personal. Solo pueden usarlo
            las personas a las que se les ha creado una cuenta, para gestionar su día a día: fichajes, ausencias, turnos,
            tareas, calendario, tickets, comunicados y su gestor de contraseñas personal. {RESPONSABLE} es la responsable
            de los datos que se tratan en Integra.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Qué datos trata y para qué</h2>
          <p>
            Integra trata los datos que introducen las propias personas usuarias y quienes gestionan el portal para esas
            tareas (por ejemplo, datos de la ficha de empleado, fichajes, solicitudes y eventos del calendario). Se usan
            solo para el funcionamiento del portal; no se venden ni se usan para publicidad.
          </p>
          <p>
            Para detectar fallos, la app puede enviar a un servicio de monitorización de errores datos técnicos del error
            (mensaje, pantalla, navegador), sin el nombre, el correo, la dirección IP ni el contenido de los formularios de
            nadie.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Google Calendar</h2>
          <p>
            Cada persona puede conectar, si quiere, su cuenta de Google para ver sus eventos de Google Calendar dentro del
            calendario de Integra. Esto es lo que hace Integra con esos datos:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Qué pide:</strong> permiso de solo lectura de los eventos del calendario
              (<code className="text-xs">calendar.events.readonly</code>) y la dirección de correo de la cuenta, para
              mostrar cuál está conectada. Integra no puede crear, modificar ni borrar nada en Google.
            </li>
            <li>
              <strong>Para qué:</strong> mostrar a esa misma persona sus eventos (título, fecha y hora, ubicación,
              descripción y enlace) en el calendario de Integra, y tenerlos en cuenta al calcular su tiempo libre. Nadie más
              ve los eventos de Google de otra persona.
            </li>
            <li>
              <strong>Qué se guarda:</strong> los eventos no se guardan; se piden a Google cuando la persona abre el
              calendario. Solo se guardan los tokens de acceso que da Google, cifrados, y el correo de la cuenta conectada.
            </li>
            <li>
              <strong>Con quién se comparte:</strong> con nadie. Los datos de Google no se venden, no se usan para
              publicidad ni para entrenar modelos de inteligencia artificial, y nadie más que la propia persona los ve.
            </li>
            <li>
              <strong>Cómo retirar el permiso:</strong> desde Integra (Calendario → Google Calendar → Desconectar), que
              borra los tokens y retira el permiso en Google, o desde la cuenta de Google, en{" "}
              <a href="https://myaccount.google.com/connections" className="text-primary underline" target="_blank" rel="noopener noreferrer">
                Conexiones con apps de terceros
              </a>
              .
            </li>
          </ul>
          <p>
            El uso y la transferencia a cualquier otra aplicación de la información recibida de las API de Google por
            Integra se ajustará a la{" "}
            <a href={POLITICA_GOOGLE} className="text-primary underline" target="_blank" rel="noopener noreferrer">
              Política de datos de usuario de los servicios de API de Google
            </a>
            , incluidos los requisitos de uso limitado.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Seguridad y derechos</h2>
          <p>
            Los datos se guardan en servidores protegidos, con acceso restringido a cada persona según su función, y las
            comunicaciones van cifradas. Puedes pedir el acceso, la rectificación o la supresión de tus datos, y cualquier
            duda sobre esta política, escribiendo a{" "}
            <a href={`mailto:${CONTACTO}`} className="text-primary underline">
              {CONTACTO}
            </a>
            .
          </p>
        </section>
      </article>
    </main>
  );
}
