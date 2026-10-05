// Lo único que se usa de Sentry. Este archivo solo se descarga con import()
// desde monitorizacion.ts; al nombrar cada función, el build deja fuera el resto
// de la librería (grabación de sesiones, rendimiento, feedback...)
export { breadcrumbsIntegration, captureException, init, withScope } from "@sentry/react";
