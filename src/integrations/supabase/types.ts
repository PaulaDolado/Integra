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
      anuncios: {
        Row: {
          area: string
          autor_id: string | null
          contenido: string
          created_at: string
          fecha_publicacion: string
          id: string
          titulo: string
          updated_at: string
        }
        Insert: {
          area?: string
          autor_id?: string | null
          contenido: string
          created_at?: string
          fecha_publicacion?: string
          id?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          area?: string
          autor_id?: string | null
          contenido?: string
          created_at?: string
          fecha_publicacion?: string
          id?: string
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
          user_id: string
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
          user_id: string
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
          user_id?: string
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
      fichajes: {
        Row: {
          created_at: string
          empleado_id: string
          fecha_hora: string
          id: string
          tipo: string
        }
        Insert: {
          created_at?: string
          empleado_id: string
          fecha_hora?: string
          id?: string
          tipo: string
        }
        Update: {
          created_at?: string
          empleado_id?: string
          fecha_hora?: string
          id?: string
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
          created_at: string
          empleado_id: string
          estado: Database["public"]["Enums"]["vacacion_estado"]
          fecha_fin: string
          fecha_inicio: string
          id: string
          justificante_path: string | null
          motivo: string | null
          razon_especifica: string | null
          tipo_ausencia: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          empleado_id: string
          estado?: Database["public"]["Enums"]["vacacion_estado"]
          fecha_fin: string
          fecha_inicio: string
          id?: string
          justificante_path?: string | null
          motivo?: string | null
          razon_especifica?: string | null
          tipo_ausencia?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          empleado_id?: string
          estado?: Database["public"]["Enums"]["vacacion_estado"]
          fecha_fin?: string
          fecha_inicio?: string
          id?: string
          justificante_path?: string | null
          motivo?: string | null
          razon_especifica?: string | null
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
      tickets: {
        Row: {
          asignado_a_id: string | null
          autor_id: string
          created_at: string
          descripcion: string
          estado: Database["public"]["Enums"]["ticket_estado"]
          fecha_cierre: string | null
          fecha_creacion: string
          id: string
          prioridad: Database["public"]["Enums"]["ticket_prioridad"]
          titulo: string
          updated_at: string
        }
        Insert: {
          asignado_a_id?: string | null
          autor_id: string
          created_at?: string
          descripcion: string
          estado?: Database["public"]["Enums"]["ticket_estado"]
          fecha_cierre?: string | null
          fecha_creacion?: string
          id?: string
          prioridad?: Database["public"]["Enums"]["ticket_prioridad"]
          titulo: string
          updated_at?: string
        }
        Update: {
          asignado_a_id?: string | null
          autor_id?: string
          created_at?: string
          descripcion?: string
          estado?: Database["public"]["Enums"]["ticket_estado"]
          fecha_cierre?: string | null
          fecha_creacion?: string
          id?: string
          prioridad?: Database["public"]["Enums"]["ticket_prioridad"]
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
      marcar_conversacion_leida: {
        Args: { conv_id: string }
        Returns: undefined
      }
      mi_empleado_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      mis_permisos: {
        Args: Record<PropertyKey, never>
        Returns: string[]
      }
      tengo_permiso: {
        Args: { codigo: string }
        Returns: boolean
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
      ticket_estado: "abierto" | "en_progreso" | "resuelto" | "cerrado"
      ticket_prioridad: "baja" | "media" | "alta" | "urgente"
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
      ticket_estado: ["abierto", "en_progreso", "resuelto", "cerrado"],
      ticket_prioridad: ["baja", "media", "alta", "urgente"],
      vacacion_estado: ["pendiente", "aprobada", "rechazada"],
    },
  },
} as const
