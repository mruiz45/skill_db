export type User = {
  id: string;
  email: string;
  fullName: string;
  role: 'developer' | 'devops' | 'pm' | 'architect' | 'admin';
  createdAt: string;
  updatedAt: string;
};

export type Skill = {
  id: string;
  name: string;
  type: 'hard' | 'soft';
  description?: string;
};

export type UserSkill = {
  id: string;
  userId: string;
  skillId: string;
  skill?: Skill;
  level: 1 | 2 | 3 | 4 | 5; // 1: Débutant, 5: Expert
  hasCertification: boolean;
  certificationName?: string;
  certificationDate?: string;
  certificationExpiry?: string;
  version_id?: string;
};

export type Language = {
  id: string;
  name: string;
};

export type UserLanguage = {
  id: string;
  userId: string;
  languageId: string;
  language?: Language;
  level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2' | 'Native';
  hasCertification: boolean;
  certificationName?: string;
  certificationDate?: string;
  certificationExpiry?: string;
};

export type Experience = {
  id: string;
  userId: string;
  company: string;
  title: string;
  description: string;
  startDate: string;
  endDate?: string;
  current: boolean;
  skills?: Skill[];
}; 