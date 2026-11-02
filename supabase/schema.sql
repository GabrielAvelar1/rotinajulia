-- ==========================================================
-- Schema do Banco de Dados Supabase - Rotina Julia
-- ==========================================================

-- Habilita a extensão para geração de UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================================
-- 1. TABELA: site_config (Configurações do Banner e Título)
-- ==========================================================
CREATE TABLE site_config (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT DEFAULT 'Minha Rotina',
  subtitle TEXT DEFAULT 'Todas as suas tarefas em um só lugar.',
  banner_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ==========================================================
-- 2. TABELA: folders (Pastas/Categorias de Tarefas)
-- ==========================================================
CREATE TABLE folders (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  icon TEXT DEFAULT '📁',
  cover_url TEXT,
  color TEXT DEFAULT '#8b5cf6',
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ==========================================================
-- 3. TABELA: tasks (Tarefas)
-- ==========================================================
CREATE TABLE tasks (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  due_date DATE,
  color TEXT DEFAULT '#8b5cf6',
  priority TEXT DEFAULT 'media' CHECK (priority IN ('baixa', 'media', 'alta')),
  completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ==========================================================
-- 4. TABELA: routines (Definições de Hábitos/Rotinas Diárias)
-- ==========================================================
CREATE TABLE routines (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  icon TEXT DEFAULT '✅',
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ==========================================================
-- 5. TABELA: routine_logs (Registro Diário para Gráficos)
-- ==========================================================
CREATE TABLE routine_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  routine_id UUID REFERENCES routines(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  completed_date DATE NOT NULL DEFAULT CURRENT_DATE,
  completed BOOLEAN DEFAULT true,
  UNIQUE(routine_id, completed_date)
);

-- ==========================================================
-- 6. TABELA: playlist (Músicas e Vídeos do YouTube)
-- ==========================================================
CREATE TABLE playlist (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  youtube_url TEXT NOT NULL,
  youtube_id TEXT NOT NULL,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ==========================================================
-- HABILITAR ROW LEVEL SECURITY (RLS) EM TODAS AS TABELAS
-- ==========================================================
ALTER TABLE site_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE routines ENABLE ROW LEVEL SECURITY;
ALTER TABLE routine_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE playlist ENABLE ROW LEVEL SECURITY;

-- ==========================================================
-- POLÍTICAS DE RLS (Row Level Security)
-- ==========================================================

-- Políticas para site_config
CREATE POLICY "Permitir leitura de site_config para o próprio usuário"
  ON site_config FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Permitir inserção de site_config para o próprio usuário"
  ON site_config FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Permitir atualização de site_config para o próprio usuário"
  ON site_config FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Permitir exclusão de site_config para o próprio usuário"
  ON site_config FOR DELETE
  USING (auth.uid() = user_id);

-- Políticas para folders
CREATE POLICY "Permitir leitura de folders para o próprio usuário"
  ON folders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Permitir inserção de folders para o próprio usuário"
  ON folders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Permitir atualização de folders para o próprio usuário"
  ON folders FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Permitir exclusão de folders para o próprio usuário"
  ON folders FOR DELETE
  USING (auth.uid() = user_id);

-- Políticas para tasks
CREATE POLICY "Permitir leitura de tasks para o próprio usuário"
  ON tasks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Permitir inserção de tasks para o próprio usuário"
  ON tasks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Permitir atualização de tasks para o próprio usuário"
  ON tasks FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Permitir exclusão de tasks para o próprio usuário"
  ON tasks FOR DELETE
  USING (auth.uid() = user_id);

-- Políticas para routines
CREATE POLICY "Permitir leitura de routines para o próprio usuário"
  ON routines FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Permitir inserção de routines para o próprio usuário"
  ON routines FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Permitir atualização de routines para o próprio usuário"
  ON routines FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Permitir exclusão de routines para o próprio usuário"
  ON routines FOR DELETE
  USING (auth.uid() = user_id);

-- Políticas para routine_logs
CREATE POLICY "Permitir leitura de routine_logs para o próprio usuário"
  ON routine_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Permitir inserção de routine_logs para o próprio usuário"
  ON routine_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Permitir atualização de routine_logs para o próprio usuário"
  ON routine_logs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Permitir exclusão de routine_logs para o próprio usuário"
  ON routine_logs FOR DELETE
  USING (auth.uid() = user_id);

-- Políticas para playlist
CREATE POLICY "Permitir leitura de playlist para o próprio usuário"
  ON playlist FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Permitir inserção de playlist para o próprio usuário"
  ON playlist FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Permitir atualização de playlist para o próprio usuário"
  ON playlist FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Permitir exclusão de playlist para o próprio usuário"
  ON playlist FOR DELETE
  USING (auth.uid() = user_id);

-- ==========================================================
-- STORAGE: BUCKET E POLÍTICAS DE ACESSO
-- ==========================================================

-- Bucket de armazenamento para imagens (banner e capas de pastas)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('images', 'images', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de Storage
CREATE POLICY "Users can upload images" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'images' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update their images" ON storage.objects
  FOR UPDATE USING (bucket_id = 'images' AND auth.uid() = owner);

CREATE POLICY "Public image access" ON storage.objects
  FOR SELECT USING (bucket_id = 'images');

-- ==========================================================
-- ATUALIZAÇÕES / MIGRAÇÕES COMPLEMENTARES
-- ==========================================================
ALTER TABLE folders ADD COLUMN IF NOT EXISTS cover_position TEXT DEFAULT 'center';
ALTER TABLE routines ADD COLUMN IF NOT EXISTS days_of_week TEXT DEFAULT 'all';
ALTER TABLE routines ADD COLUMN IF NOT EXISTS streak_count INTEGER DEFAULT 0;
ALTER TABLE routines ADD COLUMN IF NOT EXISTS last_completed_date DATE;
ALTER TABLE site_config ADD COLUMN IF NOT EXISTS app_icon_url TEXT;
ALTER TABLE site_config ADD COLUMN IF NOT EXISTS theme TEXT DEFAULT 'dark';
ALTER TABLE site_config ADD COLUMN IF NOT EXISTS accent_color TEXT DEFAULT '#8b5cf6';
ALTER TABLE site_config ADD COLUMN IF NOT EXISTS xp INTEGER DEFAULT 0;
ALTER TABLE site_config ADD COLUMN IF NOT EXISTS vales INTEGER DEFAULT 0;
ALTER TABLE site_config ADD COLUMN IF NOT EXISTS gamification_data JSONB DEFAULT '{}'::jsonb;
ALTER TABLE routines ADD COLUMN IF NOT EXISTS has_vale BOOLEAN DEFAULT false;


