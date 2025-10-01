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
          autor_id: string | null
          contenido: string
          created_at: string
          fecha_publicacion: string
          id: string
          titulo: string
          updated_at: string
        }
        Insert: {
          autor_id?: string | null
          contenido: string
          created_at?: string
          fecha_publicacion?: string
          id?: string
          titulo: string
          updated_at?: string
        }
        Update: {
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
      empleados: {
        Row: {
          activo: boolean
          cargo_id: string | null
          correo_electronico: string
          created_at: string
          departamento_id: string | null
          fecha_ingreso: string
          id: string
          nombre: string
          numero_telefono: string | null
          primer_apellido: string
          segundo_apellido: string
          updated_at: string
          user_id: string
        }
        Insert: {
          activo?: boolean
          cargo_id?: string | null
          correo_electronico: string
          created_at?: string
          departamento_id?: string | null
          fecha_ingreso?: string
          id?: string
          nombre: string
          numero_telefono?: string | null
          primer_apellido: string
          segundo_apellido: string
          updated_at?: string
          user_id: string
        }
        Update: {
          activo?: boolean
          cargo_id?: string | null
          correo_electronico?: string
          created_at?: string
          departamento_id?: string | null
          fecha_ingreso?: string
          id?: string
          nombre?: string
          numero_telefono?: string | null
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
          motivo: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          empleado_id: string
          estado?: Database["public"]["Enums"]["vacacion_estado"]
          fecha_fin: string
          fecha_inicio: string
          id?: string
          motivo?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          empleado_id?: string
          estado?: Database["public"]["Enums"]["vacacion_estado"]
          fecha_fin?: string
          fecha_inicio?: string
          id?: string
          motivo?: string | null
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
          fecha_limite: string | null
          id: string
          proyecto_id: string
          titulo: string
          updated_at: string
        }
        Insert: {
          asignado_a_id?: string | null
          created_at?: string
          descripcion?: string | null
          estado?: Database["public"]["Enums"]["tarea_estado"]
          fecha_limite?: string | null
          id?: string
          proyecto_id: string
          titulo: string
          updated_at?: string
        }
        Update: {
          asignado_a_id?: string | null
          created_at?: string
          descripcion?: string | null
          estado?: Database["public"]["Enums"]["tarea_estado"]
          fecha_limite?: string | null
          id?: string
          proyecto_id?: string
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
      [_ in never]: never
    }
    Enums: {
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
      proyecto_estado: ["pendiente", "en_progreso", "completado", "cancelado"],
      tarea_estado: ["pendiente", "en_progreso", "completado"],
      ticket_estado: ["abierto", "en_progreso", "resuelto", "cerrado"],
      ticket_prioridad: ["baja", "media", "alta", "urgente"],
      vacacion_estado: ["pendiente", "aprobada", "rechazada"],
    },
  },
} as const
