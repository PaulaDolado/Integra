export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      accesos_datos_pago: {
        Row: {
          accion: string
          autor_id: string | null
          created_at: string
          empleado_id: string | null
          id: string
        }
        Insert: {
          accion: string
          autor_id?: string | null
          created_at?: string
          empleado_id?: string | null
          id?: string
        }
        Update: {
          accion?: string
          autor_id?: string | null
          created_at?: string
          empleado_id?: string | null
          id?: string
        }
        Relationships: []
      }
      anuncios: {
        Row: {
          area: string
          autor_id: string | null
          contenido: string
          created_at: string
          enlace: string | null
          fecha_fin: string | null
          fecha_publicacion: string
          id: string
          tipo: string
          titulo: string
          updated_at: string
        }
        Insert: {
          area?: string
          autor_id?: string | null
          contenido: string
          created_at?: string
          enlace?: string | null
          fecha_fin?: string | null
          fecha_publicacion?: string
          id?: string
          tipo?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          area?: string
          autor_id?: string | null
          contenido?: string
          created_at?: string
          enlace?: string | null
          fecha_fin?: string | null
          fecha_publicacion?: string
          id?: string
          tipo?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "anuncios_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "empleados"
            referencedColumns: ["id"]
          },
        ]
      }
      avisos: {
        Row: {
          created_at: string
          cuerpo: string
          empleado_id: string
          enlace: string | null
          id: string
          leido_en: string | null
          tipo: string
          titulo: string
        }
        Insert: {
          created_at?: string
          cuerpo?: string
          empleado_id: string
          enlace?: string | null
          id?: string
          leido_en?: string | null
          tipo: string
          titulo: string
        }
        Update: {
          created_at?: string
          cuerpo?: string
          empleado_id?: string
          enlace?: string | null
          id?: string
          leido_en?: string | null
          tipo?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "avisos_empleado_id_fkey"
            columns: ["empleado_id"]
            isOneToOne: false
            referencedRelation: "empleados"
            referencedColumns: ["id"]
          },
        ]
      }
      boveda_claves: {
        Row: {
          created_at: string
          iteraciones: number
          sal: string
          updated_at: string
          user_id: string
          verificador: string
        }
        Insert: {
          created_at?: string
          iteraciones: number
          sal: string
          updated_at?: string
          user_id?: string
          verificador: string
        }
        Update: {
          created_at?: string
          iteraciones?: number
          sal?: string
          updated_at?: string
          user_id?: string
          verificador?: string
        }
        Relationships: []
      }
      boveda_entradas: {
        Row: {
          created_at: string
          datos: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          datos: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          datos?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "boveda_entradas_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "boveda_claves"
            referencedColumns: ["user_id"]
          },
        ]
      }
      cargos: {
        Row: {
          created_at: string
          descripcion: string | null
          id: string
          nombre: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          descripcion?: string | null
          id?: string
          nombre: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          descripcion?: string | null
          id?: string
          nombre?: string
          updated_at?: string
        }
        Relationships: []
      }
      contactos_emergencia: {
        Row: {
          created_at: string
          empleado_id: string
          id: string
          nombre: string
          relacion: string | null
          telefono: string
        }
        Insert: {
          created_at?: string
          empleado_id: string
          id?: string
          nombre: string
          relacion?: string | null
          telefono: string
        }
        Update: {
          created_at?: string
          empleado_id?: string
          id?: string
          nombre?: string
          relacion?: string | null
          telefono?: string
        }
        Relationships: [
          {
            foreignKeyName: "contactos_emergencia_empleado_id_fkey"
            columns: ["empleado_id"]
            isOneToOne: false
            referencedRelation: "empleados"
            referencedColumns: ["id"]
          },
        ]
      }
      conversacion_participantes: {
        Row: {
          conversacion_id: string
          created_at: string
          empleado_id: string
          ultimo_leido_at: string
        }
        Insert: {
          conversacion_id: string
          created_at?: string
          empleado_id: string
          ultimo_leido_at?: string
        }
        Update: {
          conversacion_id?: string
          created_at?: string
          empleado_id?: string
          ultimo_leido_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversacion_participantes_conversacion_id_fkey"
            columns: ["conversacion_id"]
            isOneToOne: false
            referencedRelation: "conversaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversacion_participantes_empleado_id_fkey"
            columns: ["empleado_id"]
            isOneToOne: false
            referencedRelation: "empleados"
            referencedColumns: ["id"]
          },
        ]
      }
      conversaciones: {
        Row: {
          created_at: string
          creado_por: string | null
          id: string
          nombre: string | null
          tipo: Database["public"]["Enums"]["conversacion_tipo"]
          ultimo_mensaje_at: string
        }
        Insert: {
          created_at?: string
          creado_por?: string | null
          id?: string
          nombre?: string | null
          tipo: Database["public"]["Enums"]["conversacion_tipo"]
          ultimo_mensaje_at?: string
        }
        Update: {
          created_at?: string
          creado_por?: string | null
          id?: string
          nombre?: string | null
          tipo?: Database["public"]["Enums"]["conversacion_tipo"]
          ultimo_mensaje_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversaciones_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "empleados"
            referencedColumns: ["id"]
          },
        ]
      }
      datos_pago: {
        Row: {
          empleado_id: string
          forma_pago: string
          iban: string | null
          updated_at: string
        }
        Insert: {
          empleado_id: string
          forma_pago?: string
          iban?: string | null
          updated_at?: string
        }
        Update: {
          empleado_id?: string
          forma_pago?: string
          iban?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "datos_pago_empleado_id_fkey"
            columns: ["empleado_id"]
            isOneToOne: true
            referencedRelation: "empleados"
            referencedColumns: ["id"]
          },
        ]
      }
      departamentos: {
        Row: {
          created_at: string
          descripcion: string | null
          id: string
          jefe_departamento_id: string | null
          nombre: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          descripcion?: string | null
          id?: string
          jefe_departamento_id?: string | null
          nombre: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          descripcion?: string | null
          id?: string
          jefe_departamento_id?: string | null
          nombre?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_jefe_departamento"
            columns: ["jefe_departamento_id"]
            isOneToOne: false
            referencedRelation: "empleados"
            referencedColumns: ["id"]
          },
        ]
      }
      departamento_permisos: {
        Row: {
          departamento_id: string
          permiso: string
        }
        Insert: {
          departamento_id: string
          permiso: string
        }
        Update: {
          departamento_id?: string
          permiso?: string
        }
        Relationships: [
          {
            foreignKeyName: "departamento_permisos_departamento_id_fkey"
            columns: ["departamento_id"]
            isOneToOne: false
            referencedRelation: "departamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departamento_permisos_permiso_fkey"
            columns: ["permiso"]
            isOneToOne: false
            referencedRelation: "permisos"
            referencedColumns: ["codigo"]
          },
        ]
      }
      empleados: {
        Row: {
          activo: boolean
          cargo_id: string | null
          ciudad: string | null
          codigo_postal: string | null
          complemento_direccion: string | null
          correo_electronico: string
          created_at: string
          departamento_id: string | null
          direccion: string | null
          es_admin: boolean
          fecha_ingreso: string
          id: string
          idioma: string
          mostrar_email_directorio: boolean
          mostrar_telefono_directorio: boolean
          nombre: string
          numero_telefono: string | null
          pais: string | null
          primer_apellido: string
          segundo_apellido: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          activo?: boolean
          cargo_id?: string | null
          ciudad?: string | null
          codigo_postal?: string | null
          complemento_direccion?: string | null
          correo_electronico: string
          created_at?: string
          departamento_id?: string | null
          direccion?: string | null
          es_admin?: boolean
          fecha_ingreso?: string
          id?: string
          idioma?: string
          mostrar_email_directorio?: boolean
          mostrar_telefono_directorio?: boolean
          nombre: string
          numero_telefono?: string | null
          pais?: string | null
          primer_apellido: string
          segundo_apellido: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          activo?: boolean
          cargo_id?: string | null
          ciudad?: string | null
          codigo_postal?: string | null
          complemento_direccion?: string | null
          correo_electronico?: string
          created_at?: string
          departamento_id?: string | null
          direccion?: string | null
          es_admin?: boolean
          fecha_ingreso?: string
          id?: string
          idioma?: string
          mostrar_email_directorio?: boolean
          mostrar_telefono_directorio?: boolean
          nombre?: string
          numero_telefono?: string | null
          pais?: string | null
          primer_apellido?: string
          segundo_apellido?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "empleados_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: false
            referencedRelation: "cargos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "empleados_departamento_id_fkey"
            columns: ["departamento_id"]
            isOneToOne: false
            referencedRelation: "departamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      evento_participantes: {
        Row: {
          created_at: string
          empleado_id: string
          evento_id: string
          id: string
        }
        Insert: {
          created_at?: string
          empleado_id: string
          evento_id: string
          id?: string
        }
        Update: {
          created_at?: string
          empleado_id?: string
          evento_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evento_participantes_empleado_id_fkey"
            columns: ["empleado_id"]
            isOneToOne: false
            referencedRelation: "empleados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evento_participantes_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "eventos"
            referencedColumns: ["id"]
          },
        ]
      }
      eventos: {
        Row: {
          creador_id: string
          created_at: string
          descripcion: string | null
          es_privado: boolean
          fecha_fin: string
          fecha_inicio: string
          id: string
          titulo: string
          ubicacion: string | null
          updated_at: string
        }
        Insert: {
          creador_id: string
          created_at?: string
          descripcion?: string | null
          es_privado?: boolean
          fecha_fin: string
          fecha_inicio: string
          id?: string
          titulo: string
          ubicacion?: string | null
          updated_at?: string
        }
        Update: {
          creador_id?: string
          created_at?: string
          descripcion?: string | null
          es_privado?: boolean
          fecha_fin?: string
          fecha_inicio?: string
          id?: string
          titulo?: string
          ubicacion?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "eventos_creador_id_fkey"
            columns: ["creador_id"]
            isOneToOne: false
            referencedRelation: "empleados"
            referencedColumns: ["id"]
          },
        ]
      }
      fichaje_correcciones: {
        Row: {
          accion: string
          autor_id: string | null
          created_at: string
          empleado_id: string
          fecha_hora_anterior: string | null
          fecha_hora_nueva: string | null
          fichaje_id: string
          id: string
          justificacion: string
          tipo: string
        }
        Insert: {
          accion: string
          autor_id?: string | null
          created_at?: string
          empleado_id: string
          fecha_hora_anterior?: string | null
          fecha_hora_nueva?: string | null
          fichaje_id: string
          id?: string
          justificacion: string
          tipo: string
        }
        Update: {
          accion?: string
          autor_id?: string | null
          created_at?: string
          empleado_id?: string
          fecha_hora_anterior?: string | null
          fecha_hora_nueva?: string | null
          fichaje_id?: string
          id?: string
          justificacion?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "fichaje_correcciones_fichaje_id_fkey"
            columns: ["fichaje_id"]
            isOneToOne: false
            referencedRelation: "fichajes"
            referencedColumns: ["id"]
          },
        ]
      }
      fichajes: {
        Row: {
          anulado: boolean
          corregido_en: string | null
          corregido_por: string | null
          created_at: string
          empleado_id: string
          es_manual: boolean
          fecha_hora: string
          fecha_hora_original: string | null
          id: string
          justificacion: string | null
          tipo: string
        }
        Insert: {
          anulado?: boolean
          corregido_en?: string | null
          corregido_por?: string | null
          created_at?: string
          empleado_id: string
          es_manual?: boolean
          fecha_hora?: string
          fecha_hora_original?: string | null
          id?: string
          justificacion?: string | null
          tipo: string
        }
        Update: {
          anulado?: boolean
          corregido_en?: string | null
          corregido_por?: string | null
          created_at?: string
          empleado_id?: string
          es_manual?: boolean
          fecha_hora?: string
          fecha_hora_original?: string | null
          id?: string
          justificacion?: string | null
          tipo?: string
        }
        Relationships: []
      }
      mensajes: {
        Row: {
          autor_id: string | null
          contenido: string
          conversacion_id: string
          created_at: string
          id: string
        }
        Insert: {
          autor_id?: string | null
          contenido: string
          conversacion_id: string
          created_at?: string
          id?: string
        }
        Update: {
          autor_id?: string | null
          contenido?: string
          conversacion_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mensajes_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "empleados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensajes_conversacion_id_fkey"
            columns: ["conversacion_id"]
            isOneToOne: false
            referencedRelation: "conversaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      nota_aperturas: {
        Row: {
          abierta_at: string
          empleado_id: string
          nota_id: string
        }
        Insert: {
          abierta_at?: string
          empleado_id: string
          nota_id: string
        }
        Update: {
          abierta_at?: string
          empleado_id?: string
          nota_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nota_aperturas_empleado_id_fkey"
            columns: ["empleado_id"]
            isOneToOne: false
            referencedRelation: "empleados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nota_aperturas_nota_id_fkey"
            columns: ["nota_id"]
            isOneToOne: false
            referencedRelation: "notas"
            referencedColumns: ["id"]
          },
        ]
      }
      nota_cambios: {
        Row: {
          autor_id: string | null
          created_at: string
          datos: string
          id: number
          nota_id: string
          sesion: string
        }
        Insert: {
          autor_id?: string | null
          created_at?: string
          datos: string
          id?: never
          nota_id: string
          sesion: string
        }
        Update: {
          autor_id?: string | null
          created_at?: string
          datos?: string
          id?: never
          nota_id?: string
          sesion?: string
        }
        Relationships: [
          {
            foreignKeyName: "nota_cambios_nota_id_fkey"
            columns: ["nota_id"]
            isOneToOne: false
            referencedRelation: "notas"
            referencedColumns: ["id"]
          },
        ]
      }
      nota_colaboradores: {
        Row: {
          created_at: string
          empleado_id: string
          nota_id: string
          rol: string
        }
        Insert: {
          created_at?: string
          empleado_id: string
          nota_id: string
          rol: string
        }
        Update: {
          created_at?: string
          empleado_id?: string
          nota_id?: string
          rol?: string
        }
        Relationships: [
          {
            foreignKeyName: "nota_colaboradores_nota_id_fkey"
            columns: ["nota_id"]
            isOneToOne: false
            referencedRelation: "notas"
            referencedColumns: ["id"]
          },
        ]
      }
      notas: {
        Row: {
          actualizado_por: string | null
          created_at: string
          estado: string
          estado_hasta: number
          extracto: string
          formato: string
          id: string
          propietario_id: string
          titulo: string
          updated_at: string
        }
        Insert: {
          actualizado_por?: string | null
          created_at?: string
          estado?: string
          estado_hasta?: number
          extracto?: string
          formato?: string
          id?: string
          propietario_id: string
          titulo?: string
          updated_at?: string
        }
        Update: {
          actualizado_por?: string | null
          created_at?: string
          estado?: string
          estado_hasta?: number
          extracto?: string
          formato?: string
          id?: string
          propietario_id?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      permisos: {
        Row: {
          codigo: string
          descripcion: string
        }
        Insert: {
          codigo: string
          descripcion: string
        }
        Update: {
          codigo?: string
          descripcion?: string
        }
        Relationships: []
      }
      plantillas_solucion: {
        Row: {
          contenido: string
          id: string
          nombre: string
          orden: number
        }
        Insert: {
          contenido: string
          id?: string
          nombre: string
          orden?: number
        }
        Update: {
          contenido?: string
          id?: string
          nombre?: string
          orden?: number
        }
        Relationships: []
      }
      proyecto_miembros: {
        Row: {
          created_at: string
          empleado_id: string
          id: string
          proyecto_id: string
        }
        Insert: {
          created_at?: string
          empleado_id: string
          id?: string
          proyecto_id: string
        }
        Update: {
          created_at?: string
          empleado_id?: string
          id?: string
          proyecto_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proyecto_miembros_empleado_id_fkey"
            columns: ["empleado_id"]
            isOneToOne: false
            referencedRelation: "empleados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proyecto_miembros_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
        ]
      }
      proyectos: {
        Row: {
          created_at: string
          descripcion: string | null
          estado: Database["public"]["Enums"]["proyecto_estado"]
          fecha_fin: string
          fecha_inicio: string
          id: string
          nombre: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          descripcion?: string | null
          estado?: Database["public"]["Enums"]["proyecto_estado"]
          fecha_fin: string
          fecha_inicio: string
          id?: string
          nombre: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          descripcion?: string | null
          estado?: Database["public"]["Enums"]["proyecto_estado"]
          fecha_fin?: string
          fecha_inicio?: string
          id?: string
          nombre?: string
          updated_at?: string
        }
        Relationships: []
      }
      solicitudes_vacacion: {
        Row: {
          comentario_revision: string | null
          created_at: string
          empleado_id: string
          estado: Database["public"]["Enums"]["vacacion_estado"]
          fecha_revision: string | null
          fecha_fin: string
          fecha_inicio: string
          id: string
          justificante_path: string | null
          motivo: string | null
          razon_especifica: string | null
          revisado_por: string | null
          tipo_ausencia: string
          updated_at: string
        }
        Insert: {
          comentario_revision?: string | null
          created_at?: string
          empleado_id: string
          estado?: Database["public"]["Enums"]["vacacion_estado"]
          fecha_revision?: string | null
          fecha_fin: string
          fecha_inicio: string
          id?: string
          justificante_path?: string | null
          motivo?: string | null
          razon_especifica?: string | null
          revisado_por?: string | null
          tipo_ausencia?: string
          updated_at?: string
        }
        Update: {
          comentario_revision?: string | null
          created_at?: string
          empleado_id?: string
          estado?: Database["public"]["Enums"]["vacacion_estado"]
          fecha_revision?: string | null
          fecha_fin?: string
          fecha_inicio?: string
          id?: string
          justificante_path?: string | null
          motivo?: string | null
          razon_especifica?: string | null
          revisado_por?: string | null
          tipo_ausencia?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "solicitudes_vacacion_empleado_id_fkey"
            columns: ["empleado_id"]
            isOneToOne: false
            referencedRelation: "empleados"
            referencedColumns: ["id"]
          },
        ]
      }
      solicitudes_turno: {
        Row: {
          comentario_revision: string | null
          companero_id: string | null
          created_at: string
          estado: string
          fecha: string
          fecha_respuesta_companero: string | null
          fecha_revision: string | null
          id: string
          motivo: string
          respuesta_companero: string | null
          revisado_por: string | null
          solicitante_id: string
          turno_actual_id: string
          turno_solicitado_id: string
          updated_at: string
        }
        Insert: {
          comentario_revision?: string | null
          companero_id?: string | null
          created_at?: string
          estado?: string
          fecha: string
          fecha_respuesta_companero?: string | null
          fecha_revision?: string | null
          id?: string
          motivo: string
          respuesta_companero?: string | null
          revisado_por?: string | null
          solicitante_id: string
          turno_actual_id: string
          turno_solicitado_id: string
          updated_at?: string
        }
        Update: {
          comentario_revision?: string | null
          companero_id?: string | null
          created_at?: string
          estado?: string
          fecha?: string
          fecha_respuesta_companero?: string | null
          fecha_revision?: string | null
          id?: string
          motivo?: string
          respuesta_companero?: string | null
          revisado_por?: string | null
          solicitante_id?: string
          turno_actual_id?: string
          turno_solicitado_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      tareas: {
        Row: {
          asignado_a_id: string | null
          created_at: string
          descripcion: string | null
          estado: Database["public"]["Enums"]["tarea_estado"]
          etiquetas: string[]
          fecha_limite: string | null
          id: string
          imagen_path: string | null
          propiedades: Json
          proyecto_id: string | null
          resumen: string | null
          subtareas: Json
          tiempo_estimado_min: number | null
          tiempo_real_min: number
          titulo: string
          updated_at: string
        }
        Insert: {
          asignado_a_id?: string | null
          created_at?: string
          descripcion?: string | null
          estado?: Database["public"]["Enums"]["tarea_estado"]
          etiquetas?: string[]
          fecha_limite?: string | null
          id?: string
          imagen_path?: string | null
          propiedades?: Json
          proyecto_id?: string | null
          resumen?: string | null
          subtareas?: Json
          tiempo_estimado_min?: number | null
          tiempo_real_min?: number
          titulo: string
          updated_at?: string
        }
        Update: {
          asignado_a_id?: string | null
          created_at?: string
          descripcion?: string | null
          estado?: Database["public"]["Enums"]["tarea_estado"]
          etiquetas?: string[]
          fecha_limite?: string | null
          id?: string
          imagen_path?: string | null
          propiedades?: Json
          proyecto_id?: string | null
          resumen?: string | null
          subtareas?: Json
          tiempo_estimado_min?: number | null
          tiempo_real_min?: number
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tareas_asignado_a_id_fkey"
            columns: ["asignado_a_id"]
            isOneToOne: false
            referencedRelation: "empleados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tareas_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_adjuntos: {
        Row: {
          autor_id: string | null
          created_at: string
          id: string
          nombre: string
          path: string
          seguimiento_id: string | null
          tamano: number
          ticket_id: string
        }
        Insert: {
          autor_id?: string | null
          created_at?: string
          id?: string
          nombre: string
          path: string
          seguimiento_id?: string | null
          tamano: number
          ticket_id: string
        }
        Update: {
          autor_id?: string | null
          created_at?: string
          id?: string
          nombre?: string
          path?: string
          seguimiento_id?: string | null
          tamano?: number
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_adjuntos_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "empleados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_adjuntos_seguimiento_id_fkey"
            columns: ["seguimiento_id"]
            isOneToOne: false
            referencedRelation: "ticket_seguimientos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_adjuntos_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_seguimientos: {
        Row: {
          autor_id: string | null
          contenido: string
          created_at: string
          id: string
          ticket_id: string
          tipo: string
        }
        Insert: {
          autor_id?: string | null
          contenido: string
          created_at?: string
          id?: string
          ticket_id: string
          tipo: string
        }
        Update: {
          autor_id?: string | null
          contenido?: string
          created_at?: string
          id?: string
          ticket_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_seguimientos_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "empleados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_seguimientos_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          asignado_a_id: string | null
          autor_id: string
          created_at: string
          descripcion: string
          estado: string
          fecha_cierre: string | null
          fecha_creacion: string
          fecha_resolucion: string | null
          id: string
          prioridad: string
          tipo: string
          titulo: string
          updated_at: string
        }
        Insert: {
          asignado_a_id?: string | null
          autor_id: string
          created_at?: string
          descripcion: string
          estado?: string
          fecha_cierre?: string | null
          fecha_creacion?: string
          fecha_resolucion?: string | null
          id?: string
          prioridad?: string
          tipo?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          asignado_a_id?: string | null
          autor_id?: string
          created_at?: string
          descripcion?: string
          estado?: string
          fecha_cierre?: string | null
          fecha_creacion?: string
          fecha_resolucion?: string | null
          id?: string
          prioridad?: string
          tipo?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_asignado_a_id_fkey"
            columns: ["asignado_a_id"]
            isOneToOne: false
            referencedRelation: "empleados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "empleados"
            referencedColumns: ["id"]
          },
        ]
      }
      turnos: {
        Row: {
          hora_fin: string
          hora_inicio: string
          id: string
          nombre: string
          orden: number
        }
        Insert: {
          hora_fin: string
          hora_inicio: string
          id?: string
          nombre: string
          orden?: number
        }
        Update: {
          hora_fin?: string
          hora_inicio?: string
          id?: string
          nombre?: string
          orden?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      abrir_conversacion_directa: {
        Args: { otro_empleado_id: string }
        Returns: string
      }
      crear_grupo: {
        Args: { nombre_grupo: string; participantes: string[] }
        Returns: string
      }
      cambiar_clave_maestra: {
        Args: {
          p_entradas: Json
          p_iteraciones: number
          p_sal: string
          p_verificador: string
        }
        Returns: undefined
      }
      cancelar_solicitud_turno: {
        Args: { p_solicitud: string }
        Returns: undefined
      }
      contactos_emergencia_plantilla: {
        Args: Record<PropertyKey, never>
        Returns: {
          empleado_id: string
          empleado: string
          departamento: string | null
          telefono_empleado: string | null
          contacto_id: string | null
          contacto: string | null
          relacion: string | null
          telefono: string | null
        }[]
      }
      crear_solicitud_turno: {
        Args: { p_fecha: string; p_turno_actual: string; p_turno_solicitado: string; p_companero: string | null; p_motivo: string }
        Returns: string
      }
      accesos_datos_pago_recientes: {
        Args: Record<PropertyKey, never>
        Returns: { id: string; autor: string; empleado: string; accion: string; created_at: string }[]
      }
      actualizar_ticket: {
        Args: {
          p_ticket: string
          p_tipo: string
          p_prioridad: string
          p_estado: string
          p_asignado: string | null
        }
        Returns: undefined
      }
      anadir_fichaje_manual: {
        Args: { p_empleado: string; p_tipo: string; p_fecha_hora: string; p_justificacion: string }
        Returns: string
      }
      anular_fichaje: {
        Args: { p_fichaje: string; p_justificacion: string }
        Returns: undefined
      }
      autores_correcciones_fichajes: {
        Args: Record<PropertyKey, never>
        Returns: { id: string; nombre: string }[]
      }
      bandeja_ausencias: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          empleado_id: string
          empleado_nombre: string
          departamento: string | null
          tipo_ausencia: string
          razon_especifica: string | null
          fecha_inicio: string
          fecha_fin: string
          motivo: string | null
          justificante_path: string | null
          estado: Database["public"]["Enums"]["vacacion_estado"]
          created_at: string
          revisado_por_nombre: string | null
          fecha_revision: string | null
          comentario_revision: string | null
          es_mia: boolean
        }[]
      }
      datos_pago_plantilla: {
        Args: Record<PropertyKey, never>
        Returns: {
          empleado_id: string
          empleado: string
          departamento: string | null
          forma_pago: string | null
          iban_enmascarado: string | null
          actualizado: string | null
        }[]
      }
      directorio_empleados: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          nombre: string
          primer_apellido: string
          segundo_apellido: string
          cargo: string | null
          departamento: string | null
          numero_telefono: string | null
          correo_electronico: string | null
        }[]
      }
      es_participante: {
        Args: { conv_id: string }
        Returns: boolean
      }
      exportar_datos_pago: {
        Args: Record<PropertyKey, never>
        Returns: { empleado: string; departamento: string | null; forma_pago: string; iban: string | null }[]
      }
      gestion_empleados: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          nombre: string
          primer_apellido: string
          segundo_apellido: string
          correo_electronico: string
          numero_telefono: string | null
          cargo_id: string | null
          cargo: string | null
          departamento_id: string | null
          departamento: string | null
          fecha_ingreso: string
          activo: boolean
          es_admin: boolean
          tiene_cuenta: boolean
          es_yo: boolean | null
        }[]
      }
      guardar_datos_pago: {
        Args: { p_empleado: string; p_forma_pago: string; p_iban: string }
        Returns: undefined
      }
      guardar_empleado: {
        Args: {
          p_id: string | null
          p_nombre: string
          p_primer_apellido: string
          p_segundo_apellido: string
          p_correo: string
          p_telefono: string | null
          p_cargo_id: string | null
          p_departamento_id: string | null
          p_fecha_ingreso: string | null
          p_activo: boolean
        }
        Returns: string
      }
      marcar_avisos_leidos: {
        Args: { p_ids?: string[] }
        Returns: number
      }
      marcar_conversacion_leida: {
        Args: { conv_id: string }
        Returns: undefined
      }
      mi_conexion_google_calendar: {
        Args: Record<PropertyKey, never>
        Returns: { email: string | null; conectado_en: string }[]
      }
      mi_empleado_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      mi_token_calendario: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      mis_permisos: {
        Args: Record<PropertyKey, never>
        Returns: string[]
      }
      plantilla_fichajes: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          nombre: string
          departamento_id: string | null
          departamento: string | null
        }[]
      }
      modificar_fichaje: {
        Args: { p_fichaje: string; p_fecha_hora: string; p_justificacion: string }
        Returns: undefined
      }
      organigrama: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          nombre: string
          cargo: string | null
          departamento_id: string | null
          departamento: string | null
          es_responsable: boolean | null
        }[]
      }
      personas_tickets: {
        Args: Record<PropertyKey, never>
        Returns: { id: string; nombre: string }[]
      }
      regenerar_token_calendario: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      responder_intercambio_turno: {
        Args: { p_solicitud: string; p_aceptar: boolean; p_comentario?: string }
        Returns: undefined
      }
      responder_ticket: {
        Args: { p_ticket: string; p_contenido: string }
        Returns: string
      }
      revisar_solicitud_turno: {
        Args: { p_solicitud: string; p_aprobar: boolean; p_comentario?: string }
        Returns: undefined
      }
      solicitudes_turno_detalle: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          fecha: string
          estado: string
          motivo: string
          solicitante_id: string
          solicitante: string
          departamento: string | null
          companero_id: string | null
          companero: string | null
          turno_actual: string
          turno_solicitado: string
          respuesta_companero: string | null
          fecha_respuesta_companero: string | null
          revisor: string | null
          fecha_revision: string | null
          comentario_revision: string | null
          created_at: string
        }[]
      }
      revisar_ausencia: {
        Args: {
          solicitud_id: string
          decision: Database["public"]["Enums"]["vacacion_estado"]
          comentario?: string
        }
        Returns: undefined
      }
      solucionar_ticket: {
        Args: { p_ticket: string; p_contenido: string }
        Returns: string
      }
      ver_iban: {
        Args: { p_empleado: string }
        Returns: string | null
      }
      tecnicos_tickets: {
        Args: Record<PropertyKey, never>
        Returns: { id: string; nombre: string }[]
      }
      tengo_permiso: {
        Args: { codigo: string }
        Returns: boolean
      }
      valorar_solucion: {
        Args: { p_ticket: string; p_aprobar: boolean; p_comentario?: string }
        Returns: undefined
      }
      rol_en_nota: {
        Args: { p_nota: string }
        Returns: string | null
      }
      mis_notas: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          titulo: string
          formato: string
          extracto: string
          mi_rol: string
          propietario_id: string
          propietario_nombre: string
          colaboradores: number
          actualizado_por_nombre: string | null
          created_at: string
          updated_at: string
        }[]
      }
      abrir_nota: {
        Args: { p_nota: string }
        Returns: {
          id: string
          titulo: string
          formato: string
          propietario_id: string
          estado: string
          estado_hasta: number
          mi_rol: string
        }[]
      }
      crear_nota: {
        Args: { p_titulo?: string; p_formato?: string }
        Returns: string
      }
      actualizar_nota: {
        Args: { p_nota: string; p_titulo?: string; p_formato?: string }
        Returns: undefined
      }
      guardar_cambios_nota: {
        Args: { p_nota: string; p_datos: string; p_sesion: string; p_extracto?: string }
        Returns: number
      }
      compactar_nota: {
        Args: { p_nota: string; p_estado: string; p_base: number; p_hasta: number; p_cuantos: number }
        Returns: boolean
      }
      colaboradores_nota: {
        Args: { p_nota: string }
        Returns: {
          empleado_id: string
          nombre: string
          primer_apellido: string
          cargo: string | null
          departamento: string | null
          rol: string
        }[]
      }
      compartir_nota: {
        Args: { p_nota: string; p_empleado: string; p_rol: string }
        Returns: undefined
      }
      quitar_colaborador_nota: {
        Args: { p_nota: string; p_empleado: string }
        Returns: undefined
      }
      eliminar_nota: {
        Args: { p_nota: string }
        Returns: undefined
      }
      registrar_apertura_nota: {
        Args: { p_nota: string }
        Returns: undefined
      }
      notas_recientes: {
        Args: { p_limite?: number }
        Returns: {
          id: string
          titulo: string
          extracto: string
          mi_rol: string | null
          propietario_nombre: string
          abierta_at: string
          updated_at: string
        }[]
      }
      mis_conversaciones: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          tipo: Database["public"]["Enums"]["conversacion_tipo"]
          nombre: string | null
          otro_empleado_id: string | null
          num_participantes: number
          ultimo_mensaje: string | null
          ultimo_mensaje_autor_id: string | null
          ultimo_mensaje_at: string
          no_leidos: number
        }[]
      }
    }
    Enums: {
      conversacion_tipo: "directa" | "grupo"
      proyecto_estado: "pendiente" | "en_progreso" | "completado" | "cancelado"
      tarea_estado: "pendiente" | "en_progreso" | "completado"
      vacacion_estado: "pendiente" | "aprobada" | "rechazada"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      conversacion_tipo: ["directa", "grupo"],
      proyecto_estado: ["pendiente", "en_progreso", "completado", "cancelado"],
      tarea_estado: ["pendiente", "en_progreso", "completado"],
      vacacion_estado: ["pendiente", "aprobada", "rechazada"],
    },
  },
} as const
