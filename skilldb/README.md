# SkillDB - Gestion des compétences professionnelles

Cette application web permet aux professionnels du secteur IT de répertorier et valoriser leurs compétences techniques, soft skills, langues et expériences professionnelles.

## Fonctionnalités principales

- Gestion des profils utilisateurs (développeurs, DevOps, PM, architectes)
- Enregistrement des compétences techniques et soft skills
- Suivi des certifications avec dates de validité
- Gestion de l'expérience professionnelle
- Recherche avancée de compétences et de personnes
- Interface administrateur pour la gestion des utilisateurs et des compétences

## Prérequis

Avant de pouvoir exécuter l'application, vous devez avoir installé:

- [Node.js](https://nodejs.org/) (v16 ou supérieur)
- npm (inclus avec Node.js) ou [yarn](https://yarnpkg.com/)
- Un compte [Supabase](https://supabase.com/) (gratuit)

## Configuration de Supabase

1. Créez un compte sur [Supabase](https://supabase.com/)
2. Créez un nouveau projet
3. Notez l'URL de votre projet et la clé anon (public)
4. Créez les tables suivantes dans Supabase:

### Tables SQL

```sql
-- Extension UUID pour générer des identifiants
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table des utilisateurs
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  fullName TEXT NOT NULL,
  role TEXT CHECK (role IN ('developer', 'devops', 'pm', 'architect', 'admin')) NOT NULL,
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updatedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des compétences
CREATE TABLE skills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('hard', 'soft')) NOT NULL,
  description TEXT,
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des compétences utilisateur
CREATE TABLE user_skills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  userId UUID REFERENCES users(id) ON DELETE CASCADE,
  skillId UUID REFERENCES skills(id) ON DELETE CASCADE,
  level INTEGER CHECK (level BETWEEN 1 AND 5) NOT NULL,
  hasCertification BOOLEAN DEFAULT FALSE,
  certificationName TEXT,
  certificationDate DATE,
  certificationExpiry DATE,
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updatedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(userId, skillId)
);

-- Table des expériences professionnelles
CREATE TABLE experiences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  userId UUID REFERENCES users(id) ON DELETE CASCADE,
  company TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  startDate DATE NOT NULL,
  endDate DATE,
  current BOOLEAN DEFAULT FALSE,
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updatedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table de relation entre expériences et compétences
CREATE TABLE experience_skills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  experienceId UUID REFERENCES experiences(id) ON DELETE CASCADE,
  skillId UUID REFERENCES skills(id) ON DELETE CASCADE,
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(experienceId, skillId)
);
```

### Politique de sécurité (RLS)

Configurez les politiques de sécurité de Row Level Security (RLS) dans Supabase pour chaque table:

```sql
-- Activer RLS sur toutes les tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE experiences ENABLE ROW LEVEL SECURITY;
ALTER TABLE experience_skills ENABLE ROW LEVEL SECURITY;

-- Politiques pour les utilisateurs
CREATE POLICY "Les utilisateurs peuvent voir tous les profils"
  ON users FOR SELECT
  USING (true);

CREATE POLICY "Les utilisateurs peuvent modifier leur propre profil"
  ON users FOR UPDATE
  USING (auth.uid() = id);

-- Politiques pour les compétences
CREATE POLICY "Tout le monde peut voir les compétences"
  ON skills FOR SELECT
  USING (true);

CREATE POLICY "Seuls les admins peuvent modifier les compétences"
  ON skills FOR INSERT
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
  
CREATE POLICY "Seuls les admins peuvent mettre à jour les compétences"
  ON skills FOR UPDATE
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Seuls les admins peuvent supprimer les compétences"
  ON skills FOR DELETE
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- Politiques pour les compétences utilisateur
CREATE POLICY "Les utilisateurs peuvent voir toutes les compétences utilisateur"
  ON user_skills FOR SELECT
  USING (true);

CREATE POLICY "Les utilisateurs peuvent ajouter leurs propres compétences"
  ON user_skills FOR INSERT
  USING (auth.uid() = userId);

CREATE POLICY "Les utilisateurs peuvent modifier leurs propres compétences"
  ON user_skills FOR UPDATE
  USING (auth.uid() = userId);

CREATE POLICY "Les utilisateurs peuvent supprimer leurs propres compétences"
  ON user_skills FOR DELETE
  USING (auth.uid() = userId);

-- Politiques pour les expériences
CREATE POLICY "Les utilisateurs peuvent voir toutes les expériences"
  ON experiences FOR SELECT
  USING (true);

CREATE POLICY "Les utilisateurs peuvent ajouter leurs propres expériences"
  ON experiences FOR INSERT
  USING (auth.uid() = userId);

CREATE POLICY "Les utilisateurs peuvent modifier leurs propres expériences"
  ON experiences FOR UPDATE
  USING (auth.uid() = userId);

CREATE POLICY "Les utilisateurs peuvent supprimer leurs propres expériences"
  ON experiences FOR DELETE
  USING (auth.uid() = userId);

-- Politiques pour les relations expériences-compétences
CREATE POLICY "Les utilisateurs peuvent voir toutes les relations"
  ON experience_skills FOR SELECT
  USING (true);

CREATE POLICY "Les utilisateurs peuvent ajouter des relations pour leurs expériences"
  ON experience_skills FOR INSERT
  USING (EXISTS (SELECT 1 FROM experiences WHERE id = experienceId AND userId = auth.uid()));

CREATE POLICY "Les utilisateurs peuvent supprimer des relations pour leurs expériences"
  ON experience_skills FOR DELETE
  USING (EXISTS (SELECT 1 FROM experiences WHERE id = experienceId AND userId = auth.uid()));
```

## Installation

1. Clonez ce dépôt ou téléchargez les fichiers sources
2. Ouvrez un terminal dans le dossier du projet
3. Créez un fichier `.env.local` à la racine du projet avec les informations de votre projet Supabase:

```
NEXT_PUBLIC_SUPABASE_URL=votre-url-supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=votre-clé-anon-supabase
```

### Avec npm

```bash
# Installation des dépendances
npm install
```

### Avec yarn

```bash
# Installation des dépendances
yarn install
```

## Lancement de l'application en mode développement

### Avec npm

```bash
# Démarrer le serveur de développement
npm run dev
```

### Avec yarn

```bash
# Démarrer le serveur de développement
yarn dev
```

L'application sera accessible à l'adresse [http://localhost:3000](http://localhost:3000).

## Compilation pour la production

### Avec npm

```bash
# Compiler l'application
npm run build

# Démarrer en mode production
npm start
```

### Avec yarn

```bash
# Compiler l'application
yarn build

# Démarrer en mode production
yarn start
```

## Utilisation

1. Inscrivez-vous avec votre adresse email et créez votre profil
2. Ajoutez vos compétences techniques et soft skills
3. Renseignez vos certifications avec leurs dates de validité
4. Ajoutez votre expérience professionnelle
5. Utilisez la recherche pour trouver des personnes ayant des compétences spécifiques

## Technologies utilisées

- [Next.js](https://nextjs.org/) - Framework React
- [TypeScript](https://www.typescriptlang.org/) - Langage de programmation
- [Tailwind CSS](https://tailwindcss.com/) - Framework CSS 
- [Supabase](https://supabase.com/) - Base de données PostgreSQL et authentification
- [React Hook Form](https://react-hook-form.com/) - Gestion des formulaires
- [Zod](https://zod.dev/) - Validation des données 


# Dans une instance CMD séparée, lancer:
mcp-server-supabase --access-token sbp_48f448754f08d6dea472035a53207d7df0a934b0