export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      experience_skills: {
        Row: {
          createdat: string | null
          experienceid: string | null
          id: string
          skillid: string | null
        }
        Insert: {
          createdat?: string | null
          experienceid?: string | null
          id?: string
          skillid?: string | null
        }
        Update: {
          createdat?: string | null
          experienceid?: string | null
          id?: string
          skillid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "experience_skills_experienceid_fkey"
            columns: ["experienceid"]
            isOneToOne: false
            referencedRelation: "experiences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "experience_skills_skillid_fkey"
            columns: ["skillid"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      experiences: {
        Row: {
          company: string
          createdat: string | null
          current: boolean | null
          description: string
          enddate: string | null
          id: string
          startdate: string
          title: string
          updatedat: string | null
          userid: string | null
        }
        Insert: {
          company: string
          createdat?: string | null
          current?: boolean | null
          description: string
          enddate?: string | null
          id?: string
          startdate: string
          title: string
          updatedat?: string | null
          userid?: string | null
        }
        Update: {
          company?: string
          createdat?: string | null
          current?: boolean | null
          description?: string
          enddate?: string | null
          id?: string
          startdate?: string
          title?: string
          updatedat?: string | null
          userid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "experiences_userid_fkey"
            columns: ["userid"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      skill_families: {
        Row: {
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      skill_versions: {
        Row: {
          created_at: string | null
          id: string
          skill_id: string
          version_name: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          skill_id: string
          version_name?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          skill_id?: string
          version_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "skill_versions_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      skills: {
        Row: {
          createdat: string | null
          description: string | null
          family_id: string
          id: string
          name: string
          type: string
        }
        Insert: {
          createdat?: string | null
          description?: string | null
          family_id: string
          id?: string
          name: string
          type: string
        }
        Update: {
          createdat?: string | null
          description?: string | null
          family_id?: string
          id?: string
          name?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "skills_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "skill_families"
            referencedColumns: ["id"]
          },
        ]
      }
      user_skills: {
        Row: {
          certificationdate: string | null
          certificationexpiry: string | null
          certificationname: string | null
          createdat: string | null
          hascertification: boolean | null
          id: string
          level: number
          skillid: string | null
          updatedat: string | null
          userid: string | null
          version_id: string | null
        }
        Insert: {
          certificationdate?: string | null
          certificationexpiry?: string | null
          certificationname?: string | null
          createdat?: string | null
          hascertification?: boolean | null
          id?: string
          level: number
          skillid?: string | null
          updatedat?: string | null
          userid?: string | null
          version_id?: string | null
        }
        Update: {
          certificationdate?: string | null
          certificationexpiry?: string | null
          certificationname?: string | null
          createdat?: string | null
          hascertification?: boolean | null
          id?: string
          level?: number
          skillid?: string | null
          updatedat?: string | null
          userid?: string | null
          version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_skills_skillid_fkey"
            columns: ["skillid"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_skills_userid_fkey"
            columns: ["userid"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_skills_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "skill_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          createdat: string | null
          email: string
          fullname: string
          id: string
          role: string
          updatedat: string | null
        }
        Insert: {
          createdat?: string | null
          email: string
          fullname: string
          id: string
          role: string
          updatedat?: string | null
        }
        Update: {
          createdat?: string | null
          email?: string
          fullname?: string
          id?: string
          role?: string
          updatedat?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const 