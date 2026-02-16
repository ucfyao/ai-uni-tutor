# Dynamic Universities & Courses — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace hardcoded universities/courses constants with DB-backed tables, admin CRUD UI, and dynamic frontend data fetching.

**Architecture:** New `universities` + `courses` Supabase tables → `UniversityRepository` + `CourseRepository` → `CourseService` → server actions → admin UI + `useCourseData` hook replacing all 5 consumer components. Session schema normalized from embedded JSON to `course_id` FK.

**Tech Stack:** Supabase (PostgreSQL + RLS), Next.js App Router, Mantine v8, TanStack Query, Zod, i18n (en + zh)

**Execution:** 4 waves of tasks. Verify each wave (type-check + lint) before proceeding to the next.

---

## Wave 1: Backend Foundation (Tasks 1–7)

### Task 1: SQL Migration

**Files:**

- Create: `supabase/migrations/20260216_dynamic_courses.sql`

**Step 1: Create the migration file**

```sql
-- Dynamic Universities & Courses Migration
-- Replaces hardcoded constants with DB-backed tables

-- ============================================================================
-- 1. Universities table
-- ============================================================================
CREATE TABLE universities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  short_name text NOT NULL,
  logo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE universities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "universities_select" ON universities
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "universities_admin_insert" ON universities
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "universities_admin_update" ON universities
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "universities_admin_delete" ON universities
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================================
-- 2. Courses table
-- ============================================================================
CREATE TABLE courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id uuid NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_courses_uni_code ON courses (university_id, lower(code));
CREATE INDEX idx_courses_university_id ON courses (university_id);

-- RLS
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "courses_select" ON courses
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "courses_admin_insert" ON courses
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "courses_admin_update" ON courses
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "courses_admin_delete" ON courses
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================================
-- 3. Seed existing data with deterministic UUIDs
-- ============================================================================
INSERT INTO universities (id, name, short_name) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'University of New South Wales', 'UNSW'),
  ('a0000000-0000-0000-0000-000000000002', 'University of Sydney', 'USYD'),
  ('a0000000-0000-0000-0000-000000000003', 'Macquarie University', 'MQ'),
  ('a0000000-0000-0000-0000-000000000004', 'University of Wollongong', 'UOW');

INSERT INTO courses (id, university_id, code, name) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'COMP9417', 'Machine Learning'),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'COMP9444', 'Deep Learning');

-- ============================================================================
-- 4. Add course_id FK to chat_sessions
-- ============================================================================
ALTER TABLE chat_sessions ADD COLUMN course_id uuid REFERENCES courses(id) ON DELETE SET NULL;
CREATE INDEX idx_chat_sessions_course_id ON chat_sessions (course_id);

-- Backfill: match embedded course.code to seeded courses
UPDATE chat_sessions
SET course_id = c.id
FROM courses c
WHERE chat_sessions.course->>'code' = c.code;

-- Drop the old embedded JSON column
ALTER TABLE chat_sessions DROP COLUMN course;

-- ============================================================================
-- 5. Change documents.course_id from text to uuid FK
-- ============================================================================
-- Drop old text column and recreate as uuid FK
ALTER TABLE documents DROP COLUMN IF EXISTS course_id;
ALTER TABLE documents ADD COLUMN course_id uuid REFERENCES courses(id) ON DELETE SET NULL;
CREATE INDEX idx_documents_course_id ON documents (course_id);
```

**Step 2: Commit**

```bash
git add supabase/migrations/20260216_dynamic_courses.sql
git commit -m "db: add universities and courses tables with migration"
```

---

### Task 2: TypeScript Database Types

**Files:**

- Modify: `src/types/database.ts`

**Step 1: Add universities and courses table types to `Database['public']['Tables']`**

Add after the `profiles` table block (before `chat_sessions`):

```typescript
      universities: {
        Row: {
          id: string;
          name: string;
          short_name: string;
          logo_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          short_name: string;
          logo_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          short_name?: string;
          logo_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      courses: {
        Row: {
          id: string;
          university_id: string;
          code: string;
          name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          university_id: string;
          code: string;
          name: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          university_id?: string;
          code?: string;
          name?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
```

**Step 2: Update `chat_sessions` table type**

Replace the `course` JSON field with `course_id` FK:

```typescript
      chat_sessions: {
        Row: {
          id: string;
          user_id: string;
          course_id: string | null;
          mode: string | null;
          title: string;
          is_pinned: boolean;
          is_shared: boolean;
          share_expires_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          course_id?: string | null;
          mode?: string | null;
          title: string;
          is_pinned?: boolean;
          is_shared?: boolean;
          share_expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          course_id?: string | null;
          mode?: string | null;
          title?: string;
          is_pinned?: boolean;
          is_shared?: boolean;
          share_expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
```

**Step 3: Commit**

```bash
git add src/types/database.ts
git commit -m "chore(db): update database types for universities, courses, and session FK"
```

---

### Task 3: Domain Models & Interfaces

**Files:**

- Create: `src/lib/domain/models/University.ts`
- Create: `src/lib/domain/models/Course.ts`
- Create: `src/lib/domain/interfaces/IUniversityRepository.ts`
- Create: `src/lib/domain/interfaces/ICourseRepository.ts`
- Modify: `src/lib/domain/interfaces/index.ts`

**Step 1: Create University domain model**

File: `src/lib/domain/models/University.ts`

```typescript
export interface UniversityEntity {
  id: string;
  name: string;
  shortName: string;
  logoUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUniversityDTO {
  name: string;
  shortName: string;
  logoUrl?: string | null;
}

export interface UpdateUniversityDTO {
  name?: string;
  shortName?: string;
  logoUrl?: string | null;
}
```

**Step 2: Create Course domain model**

File: `src/lib/domain/models/Course.ts`

```typescript
export interface CourseEntity {
  id: string;
  universityId: string;
  code: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCourseDTO {
  universityId: string;
  code: string;
  name: string;
}

export interface UpdateCourseDTO {
  code?: string;
  name?: string;
}
```

**Step 3: Create IUniversityRepository interface**

File: `src/lib/domain/interfaces/IUniversityRepository.ts`

```typescript
import type {
  CreateUniversityDTO,
  UniversityEntity,
  UpdateUniversityDTO,
} from '@/lib/domain/models/University';

export interface IUniversityRepository {
  findAll(): Promise<UniversityEntity[]>;
  findById(id: string): Promise<UniversityEntity | null>;
  create(dto: CreateUniversityDTO): Promise<UniversityEntity>;
  update(id: string, dto: UpdateUniversityDTO): Promise<UniversityEntity>;
  delete(id: string): Promise<void>;
}
```

**Step 4: Create ICourseRepository interface**

File: `src/lib/domain/interfaces/ICourseRepository.ts`

```typescript
import type { CourseEntity, CreateCourseDTO, UpdateCourseDTO } from '@/lib/domain/models/Course';

export interface ICourseRepository {
  findAll(): Promise<CourseEntity[]>;
  findByUniversityId(universityId: string): Promise<CourseEntity[]>;
  findById(id: string): Promise<CourseEntity | null>;
  create(dto: CreateCourseDTO): Promise<CourseEntity>;
  update(id: string, dto: UpdateCourseDTO): Promise<CourseEntity>;
  delete(id: string): Promise<void>;
}
```

**Step 5: Update interfaces index**

Add to `src/lib/domain/interfaces/index.ts`:

```typescript
export type { IUniversityRepository } from './IUniversityRepository';
export type { ICourseRepository } from './ICourseRepository';
```

**Step 6: Commit**

```bash
git add src/lib/domain/
git commit -m "feat(db): add university and course domain models and interfaces"
```

---

### Task 4: UniversityRepository

**Files:**

- Create: `src/lib/repositories/UniversityRepository.ts`

**Step 1: Implement UniversityRepository**

```typescript
import type { IUniversityRepository } from '@/lib/domain/interfaces/IUniversityRepository';
import type {
  CreateUniversityDTO,
  UniversityEntity,
  UpdateUniversityDTO,
} from '@/lib/domain/models/University';
import { DatabaseError } from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';

type UniversityRow = Database['public']['Tables']['universities']['Row'];

export class UniversityRepository implements IUniversityRepository {
  private mapToEntity(row: UniversityRow): UniversityEntity {
    return {
      id: row.id,
      name: row.name,
      shortName: row.short_name,
      logoUrl: row.logo_url,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  async findAll(): Promise<UniversityEntity[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('universities')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw new DatabaseError(`Failed to fetch universities: ${error.message}`, error);
    return (data ?? []).map((row) => this.mapToEntity(row));
  }

  async findById(id: string): Promise<UniversityEntity | null> {
    const supabase = await createClient();
    const { data, error } = await supabase.from('universities').select('*').eq('id', id).single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new DatabaseError(`Failed to fetch university: ${error.message}`, error);
    }
    if (!data) return null;
    return this.mapToEntity(data);
  }

  async create(dto: CreateUniversityDTO): Promise<UniversityEntity> {
    const supabase = await createClient();
    const insertData: Database['public']['Tables']['universities']['Insert'] = {
      name: dto.name,
      short_name: dto.shortName,
      logo_url: dto.logoUrl ?? null,
    };

    const { data, error } = await supabase
      .from('universities')
      .insert(insertData)
      .select()
      .single();

    if (error || !data)
      throw new DatabaseError(`Failed to create university: ${error?.message}`, error);
    return this.mapToEntity(data);
  }

  async update(id: string, dto: UpdateUniversityDTO): Promise<UniversityEntity> {
    const supabase = await createClient();
    const updates: Database['public']['Tables']['universities']['Update'] = {
      updated_at: new Date().toISOString(),
    };
    if (dto.name !== undefined) updates.name = dto.name;
    if (dto.shortName !== undefined) updates.short_name = dto.shortName;
    if (dto.logoUrl !== undefined) updates.logo_url = dto.logoUrl;

    const { data, error } = await supabase
      .from('universities')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error || !data)
      throw new DatabaseError(`Failed to update university: ${error?.message}`, error);
    return this.mapToEntity(data);
  }

  async delete(id: string): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase.from('universities').delete().eq('id', id);
    if (error) throw new DatabaseError(`Failed to delete university: ${error.message}`, error);
  }
}

let _universityRepository: UniversityRepository | null = null;

export function getUniversityRepository(): UniversityRepository {
  if (!_universityRepository) {
    _universityRepository = new UniversityRepository();
  }
  return _universityRepository;
}
```

**Step 2: Commit**

```bash
git add src/lib/repositories/UniversityRepository.ts
git commit -m "feat(db): add UniversityRepository"
```

---

### Task 5: CourseRepository

**Files:**

- Create: `src/lib/repositories/CourseRepository.ts`

**Step 1: Implement CourseRepository**

```typescript
import type { ICourseRepository } from '@/lib/domain/interfaces/ICourseRepository';
import type { CourseEntity, CreateCourseDTO, UpdateCourseDTO } from '@/lib/domain/models/Course';
import { DatabaseError } from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';

type CourseRow = Database['public']['Tables']['courses']['Row'];

export class CourseRepository implements ICourseRepository {
  private mapToEntity(row: CourseRow): CourseEntity {
    return {
      id: row.id,
      universityId: row.university_id,
      code: row.code,
      name: row.name,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  async findAll(): Promise<CourseEntity[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .order('code', { ascending: true });

    if (error) throw new DatabaseError(`Failed to fetch courses: ${error.message}`, error);
    return (data ?? []).map((row) => this.mapToEntity(row));
  }

  async findByUniversityId(universityId: string): Promise<CourseEntity[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .eq('university_id', universityId)
      .order('code', { ascending: true });

    if (error) throw new DatabaseError(`Failed to fetch courses: ${error.message}`, error);
    return (data ?? []).map((row) => this.mapToEntity(row));
  }

  async findById(id: string): Promise<CourseEntity | null> {
    const supabase = await createClient();
    const { data, error } = await supabase.from('courses').select('*').eq('id', id).single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new DatabaseError(`Failed to fetch course: ${error.message}`, error);
    }
    if (!data) return null;
    return this.mapToEntity(data);
  }

  async create(dto: CreateCourseDTO): Promise<CourseEntity> {
    const supabase = await createClient();
    const insertData: Database['public']['Tables']['courses']['Insert'] = {
      university_id: dto.universityId,
      code: dto.code,
      name: dto.name,
    };

    const { data, error } = await supabase.from('courses').insert(insertData).select().single();

    if (error || !data)
      throw new DatabaseError(`Failed to create course: ${error?.message}`, error);
    return this.mapToEntity(data);
  }

  async update(id: string, dto: UpdateCourseDTO): Promise<CourseEntity> {
    const supabase = await createClient();
    const updates: Database['public']['Tables']['courses']['Update'] = {
      updated_at: new Date().toISOString(),
    };
    if (dto.code !== undefined) updates.code = dto.code;
    if (dto.name !== undefined) updates.name = dto.name;

    const { data, error } = await supabase
      .from('courses')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error || !data)
      throw new DatabaseError(`Failed to update course: ${error?.message}`, error);
    return this.mapToEntity(data);
  }

  async delete(id: string): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase.from('courses').delete().eq('id', id);
    if (error) throw new DatabaseError(`Failed to delete course: ${error.message}`, error);
  }
}

let _courseRepository: CourseRepository | null = null;

export function getCourseRepository(): CourseRepository {
  if (!_courseRepository) {
    _courseRepository = new CourseRepository();
  }
  return _courseRepository;
}
```

**Step 2: Register both repos in index**

Add to `src/lib/repositories/index.ts`:

```typescript
export { UniversityRepository, getUniversityRepository } from './UniversityRepository';
export { CourseRepository, getCourseRepository } from './CourseRepository';
```

**Step 3: Commit**

```bash
git add src/lib/repositories/CourseRepository.ts src/lib/repositories/index.ts
git commit -m "feat(db): add CourseRepository and register in index"
```

---

### Task 6: CourseService

**Files:**

- Create: `src/lib/services/CourseService.ts`

**Step 1: Implement CourseService**

```typescript
import type { CourseEntity, CreateCourseDTO, UpdateCourseDTO } from '@/lib/domain/models/Course';
import type {
  CreateUniversityDTO,
  UniversityEntity,
  UpdateUniversityDTO,
} from '@/lib/domain/models/University';
import { getCourseRepository, getUniversityRepository } from '@/lib/repositories';
import type { CourseRepository } from '@/lib/repositories/CourseRepository';
import type { UniversityRepository } from '@/lib/repositories/UniversityRepository';

export class CourseService {
  private readonly uniRepo: UniversityRepository;
  private readonly courseRepo: CourseRepository;

  constructor(uniRepo?: UniversityRepository, courseRepo?: CourseRepository) {
    this.uniRepo = uniRepo ?? getUniversityRepository();
    this.courseRepo = courseRepo ?? getCourseRepository();
  }

  // University CRUD
  async getAllUniversities(): Promise<UniversityEntity[]> {
    return this.uniRepo.findAll();
  }

  async getUniversityById(id: string): Promise<UniversityEntity | null> {
    return this.uniRepo.findById(id);
  }

  async createUniversity(dto: CreateUniversityDTO): Promise<UniversityEntity> {
    return this.uniRepo.create(dto);
  }

  async updateUniversity(id: string, dto: UpdateUniversityDTO): Promise<UniversityEntity> {
    return this.uniRepo.update(id, dto);
  }

  async deleteUniversity(id: string): Promise<void> {
    return this.uniRepo.delete(id);
  }

  // Course CRUD
  async getAllCourses(): Promise<CourseEntity[]> {
    return this.courseRepo.findAll();
  }

  async getCoursesByUniversity(universityId: string): Promise<CourseEntity[]> {
    return this.courseRepo.findByUniversityId(universityId);
  }

  async getCourseById(id: string): Promise<CourseEntity | null> {
    return this.courseRepo.findById(id);
  }

  async createCourse(dto: CreateCourseDTO): Promise<CourseEntity> {
    return this.courseRepo.create(dto);
  }

  async updateCourse(id: string, dto: UpdateCourseDTO): Promise<CourseEntity> {
    return this.courseRepo.update(id, dto);
  }

  async deleteCourse(id: string): Promise<void> {
    return this.courseRepo.delete(id);
  }
}

let _courseService: CourseService | null = null;

export function getCourseService(): CourseService {
  if (!_courseService) {
    _courseService = new CourseService();
  }
  return _courseService;
}
```

**Step 2: Commit**

```bash
git add src/lib/services/CourseService.ts
git commit -m "feat(db): add CourseService"
```

---

### Task 7: Server Actions

**Files:**

- Create: `src/app/actions/courses.ts`

**Step 1: Implement server actions**

```typescript
'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { mapError } from '@/lib/errors';
import { getCourseService } from '@/lib/services/CourseService';
import { getCurrentUser, requireAdmin } from '@/lib/supabase/server';
import type { ActionResult } from '@/types/actions';

// ============================================================================
// Schemas
// ============================================================================

const createUniversitySchema = z.object({
  name: z.string().min(1).max(255),
  shortName: z.string().min(1).max(10),
  logoUrl: z.string().url().nullable().optional(),
});

const updateUniversitySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  shortName: z.string().min(1).max(10).optional(),
  logoUrl: z.string().url().nullable().optional(),
});

const createCourseSchema = z.object({
  universityId: z.string().uuid(),
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(255),
});

const updateCourseSchema = z.object({
  code: z.string().min(1).max(20).optional(),
  name: z.string().min(1).max(255).optional(),
});

// ============================================================================
// Public reads (authenticated)
// ============================================================================

export interface UniversityListItem {
  id: string;
  name: string;
  shortName: string;
  logoUrl: string | null;
}

export interface CourseListItem {
  id: string;
  universityId: string;
  code: string;
  name: string;
}

export async function fetchUniversities(): Promise<ActionResult<UniversityListItem[]>> {
  try {
    await getCurrentUser();
    const service = getCourseService();
    const entities = await service.getAllUniversities();
    return {
      success: true,
      data: entities.map((u) => ({
        id: u.id,
        name: u.name,
        shortName: u.shortName,
        logoUrl: u.logoUrl,
      })),
    };
  } catch (error) {
    return mapError(error);
  }
}

export async function fetchCourses(universityId?: string): Promise<ActionResult<CourseListItem[]>> {
  try {
    await getCurrentUser();
    const service = getCourseService();
    const entities = universityId
      ? await service.getCoursesByUniversity(universityId)
      : await service.getAllCourses();
    return {
      success: true,
      data: entities.map((c) => ({
        id: c.id,
        universityId: c.universityId,
        code: c.code,
        name: c.name,
      })),
    };
  } catch (error) {
    return mapError(error);
  }
}

// ============================================================================
// Admin mutations
// ============================================================================

export async function createUniversity(input: unknown): Promise<ActionResult<UniversityListItem>> {
  try {
    await requireAdmin();
    const parsed = createUniversitySchema.parse(input);
    const service = getCourseService();
    const entity = await service.createUniversity(parsed);
    revalidatePath('/admin/courses');
    return {
      success: true,
      data: {
        id: entity.id,
        name: entity.name,
        shortName: entity.shortName,
        logoUrl: entity.logoUrl,
      },
    };
  } catch (error) {
    return mapError(error);
  }
}

export async function updateUniversity(
  id: string,
  input: unknown,
): Promise<ActionResult<UniversityListItem>> {
  try {
    await requireAdmin();
    const parsed = updateUniversitySchema.parse(input);
    const service = getCourseService();
    const entity = await service.updateUniversity(id, parsed);
    revalidatePath('/admin/courses');
    return {
      success: true,
      data: {
        id: entity.id,
        name: entity.name,
        shortName: entity.shortName,
        logoUrl: entity.logoUrl,
      },
    };
  } catch (error) {
    return mapError(error);
  }
}

export async function deleteUniversity(id: string): Promise<ActionResult<void>> {
  try {
    await requireAdmin();
    const service = getCourseService();
    await service.deleteUniversity(id);
    revalidatePath('/admin/courses');
    return { success: true, data: undefined };
  } catch (error) {
    return mapError(error);
  }
}

export async function createCourse(input: unknown): Promise<ActionResult<CourseListItem>> {
  try {
    await requireAdmin();
    const parsed = createCourseSchema.parse(input);
    const service = getCourseService();
    const entity = await service.createCourse(parsed);
    revalidatePath('/admin/courses');
    return {
      success: true,
      data: {
        id: entity.id,
        universityId: entity.universityId,
        code: entity.code,
        name: entity.name,
      },
    };
  } catch (error) {
    return mapError(error);
  }
}

export async function updateCourse(
  id: string,
  input: unknown,
): Promise<ActionResult<CourseListItem>> {
  try {
    await requireAdmin();
    const parsed = updateCourseSchema.parse(input);
    const service = getCourseService();
    const entity = await service.updateCourse(id, parsed);
    revalidatePath('/admin/courses');
    return {
      success: true,
      data: {
        id: entity.id,
        universityId: entity.universityId,
        code: entity.code,
        name: entity.name,
      },
    };
  } catch (error) {
    return mapError(error);
  }
}

export async function deleteCourse(id: string): Promise<ActionResult<void>> {
  try {
    await requireAdmin();
    const service = getCourseService();
    await service.deleteCourse(id);
    revalidatePath('/admin/courses');
    return { success: true, data: undefined };
  } catch (error) {
    return mapError(error);
  }
}
```

**Step 2: Commit**

```bash
git add src/app/actions/courses.ts
git commit -m "feat(api): add course and university server actions"
```

**Step 3: Verify Wave 1**

Run: `npx tsc --noEmit`
Expected: may have errors in files that still reference old `chat_sessions.course` — that's OK, those are fixed in Wave 3.

---

## Wave 2: Frontend Infrastructure (Tasks 8–11)

### Task 8: Query Keys

**Files:**

- Modify: `src/lib/query-keys.ts`

**Step 1: Add university and course query keys**

Add to the `queryKeys` object:

```typescript
  universities: {
    all: ['universities'] as const,
  },
  courses: {
    all: ['courses'] as const,
    byUniversity: (uniId: string) => ['courses', uniId] as const,
  },
```

**Step 2: Commit**

```bash
git add src/lib/query-keys.ts
git commit -m "feat(ui): add university and course query keys"
```

---

### Task 9: useCourseData Hook

**Files:**

- Create: `src/hooks/useCourseData.ts`

**Step 1: Create the hook**

```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { fetchCourses, fetchUniversities } from '@/app/actions/courses';
import type { CourseListItem, UniversityListItem } from '@/app/actions/courses';
import { queryKeys } from '@/lib/query-keys';

export function useCourseData(universityId?: string | null) {
  const { data: universities = [], isLoading: isLoadingUnis } = useQuery<UniversityListItem[]>({
    queryKey: queryKeys.universities.all,
    queryFn: async () => {
      const result = await fetchUniversities();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: allCourses = [], isLoading: isLoadingCourses } = useQuery<CourseListItem[]>({
    queryKey: queryKeys.courses.all,
    queryFn: async () => {
      const result = await fetchCourses();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const courses = useMemo(() => {
    if (!universityId) return allCourses;
    return allCourses.filter((c) => c.universityId === universityId);
  }, [allCourses, universityId]);

  return {
    universities,
    courses,
    allCourses,
    isLoading: isLoadingUnis || isLoadingCourses,
  };
}
```

**Step 2: Commit**

```bash
git add src/hooks/useCourseData.ts
git commit -m "feat(ui): add useCourseData hook"
```

---

### Task 10: i18n Strings

**Files:**

- Modify: `src/i18n/translations.ts`

**Step 1: Add English strings**

In the `en` section, add to `sidebar`:

```typescript
coursesAdmin: 'Courses',
```

Add a new `coursesAdmin` section (at same level as `sidebar`, `modals`, etc.):

```typescript
coursesAdmin: {
  title: 'Course Management',
  universities: 'Universities',
  courses: 'Courses',
  addUniversity: 'Add University',
  editUniversity: 'Edit University',
  deleteUniversity: 'Delete University',
  addCourse: 'Add Course',
  editCourse: 'Edit Course',
  deleteCourse: 'Delete Course',
  name: 'Name',
  shortName: 'Short Name',
  logoUrl: 'Logo URL',
  code: 'Code',
  courseName: 'Course Name',
  university: 'University',
  courseCount: 'Courses',
  actions: 'Actions',
  confirmDeleteUniversity: 'This will also delete all courses under this university. Continue?',
  confirmDeleteCourse: 'Are you sure you want to delete this course?',
  noUniversities: 'No universities yet. Add your first university to get started.',
  noCourses: 'No courses yet. Add a course to get started.',
  noCoursesAvailable: 'No courses available. Ask an admin to add courses.',
  save: 'Save',
  cancel: 'Cancel',
},
```

**Step 2: Add Chinese strings**

In the `zh` section, add to `sidebar`:

```typescript
coursesAdmin: '课程管理',
```

Add matching `coursesAdmin` section:

```typescript
coursesAdmin: {
  title: '课程管理',
  universities: '大学',
  courses: '课程',
  addUniversity: '添加大学',
  editUniversity: '编辑大学',
  deleteUniversity: '删除大学',
  addCourse: '添加课程',
  editCourse: '编辑课程',
  deleteCourse: '删除课程',
  name: '名称',
  shortName: '简称',
  logoUrl: 'Logo URL',
  code: '课程代码',
  courseName: '课程名称',
  university: '大学',
  courseCount: '课程数',
  actions: '操作',
  confirmDeleteUniversity: '这将同时删除该大学下的所有课程。确定继续吗？',
  confirmDeleteCourse: '确定要删除此课程吗？',
  noUniversities: '暂无大学。添加你的第一所大学以开始。',
  noCourses: '暂无课程。添加课程以开始。',
  noCoursesAvailable: '暂无可用课程。请联系管理员添加课程。',
  save: '保存',
  cancel: '取消',
},
```

**Step 3: Update the `TranslationKeys` type**

Ensure `coursesAdmin` keys are included in the TypeScript type so the translations type-check properly. The translations file should already infer this if using `as const` — check the existing pattern and follow it.

**Step 4: Commit**

```bash
git add src/i18n/translations.ts
git commit -m "feat(ui): add i18n strings for course management"
```

---

### Task 11: Sidebar Link

**Files:**

- Modify: `src/components/Sidebar.tsx`

**Step 1: Add import**

Add `BookOpen` to the lucide-react import (alongside `GraduationCap`, etc.).

**Step 2: Add to JUMP_LINKS**

```typescript
const JUMP_LINKS = [
  { labelKey: 'knowledgeBase' as const, icon: GraduationCap, href: '/admin/knowledge' },
  { labelKey: 'coursesAdmin' as const, icon: BookOpen, href: '/admin/courses' },
];
```

**Step 3: Commit**

```bash
git add src/components/Sidebar.tsx
git commit -m "feat(ui): add courses admin link to sidebar"
```

**Step 4: Verify Wave 2**

Run: `npx tsc --noEmit`
Expected: Errors still expected in SessionRepository, chat actions, and consumer components (Wave 3 fixes those).

---

## Wave 3: Admin UI + Component Migration (Tasks 12–18)

### Task 12: Admin Courses Page

**Files:**

- Create: `src/app/(protected)/admin/courses/page.tsx`
- Create: `src/app/(protected)/admin/courses/AdminCoursesClient.tsx`

**Step 1: Create server page**

File: `src/app/(protected)/admin/courses/page.tsx`

```typescript
import { AlertCircle } from 'lucide-react';
import { Alert, Container } from '@mantine/core';
import { getCourseService } from '@/lib/services/CourseService';
import { getCurrentUser } from '@/lib/supabase/server';
import { AdminCoursesClient } from './AdminCoursesClient';

export default async function CoursesPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <Container size="md" py={48}>
        <Alert variant="light" color="blue" icon={<AlertCircle size={16} />}>
          Please sign in to manage courses.
        </Alert>
      </Container>
    );
  }

  const service = getCourseService();
  const [universities, courses] = await Promise.all([
    service.getAllUniversities(),
    service.getAllCourses(),
  ]);

  const initialUniversities = universities.map((u) => ({
    id: u.id,
    name: u.name,
    shortName: u.shortName,
    logoUrl: u.logoUrl,
  }));

  const initialCourses = courses.map((c) => ({
    id: c.id,
    universityId: c.universityId,
    code: c.code,
    name: c.name,
  }));

  return (
    <AdminCoursesClient
      initialUniversities={initialUniversities}
      initialCourses={initialCourses}
    />
  );
}
```

**Step 2: Create client component**

File: `src/app/(protected)/admin/courses/AdminCoursesClient.tsx`

This is a larger component (~300 lines). It uses Mantine `Tabs`, `Table`, `Modal`, `TextInput`, `Select`, `Button`, `ActionIcon`, `Group`, `Stack`, `Text`, `Alert`.

Key structure:

- Two tabs: Universities | Courses
- Each tab has a table + Add button
- Add/Edit modals with form fields
- Delete confirmation modals
- TanStack Query for data fetching (hydrated from server initial data)
- Server actions for mutations

The implementing agent should build this component following these patterns from `KnowledgeClient.tsx`:

- `'use client'` directive
- `useQuery` with initial data from props
- `queryClient.invalidateQueries()` after mutations
- Mantine UI components
- `useLanguage()` for i18n

**Key UI elements per tab:**

Universities tab:

- Header: "Universities" + "Add University" button
- Table columns: Name | Short Name | Courses (count) | Actions (edit/delete icons)
- Add/Edit modal: TextInput for name, TextInput for shortName (max 10), TextInput for logoUrl (optional)
- Delete modal: confirmation text warning about cascading

Courses tab:

- Header: "Courses" + University filter Select + "Add Course" button
- Table columns: Code | Name | University | Actions (edit/delete icons)
- Add/Edit modal: Select for university, TextInput for code, TextInput for name
- Delete modal: simple confirmation

**Step 3: Commit**

```bash
git add src/app/(protected)/admin/courses/
git commit -m "feat(ui): add admin courses management page"
```

---

### Task 13: Update Session Domain Model & Repository

**Files:**

- Modify: `src/lib/domain/models/Session.ts`
- Modify: `src/lib/domain/interfaces/ISessionRepository.ts`
- Modify: `src/lib/repositories/SessionRepository.ts`

**Step 1: Update Session domain model**

In `src/lib/domain/models/Session.ts`, change `CreateSessionDTO.course` from `Course` object to `courseId` string:

```typescript
import { TutoringMode } from '@/types';

export interface SessionEntity {
  id: string;
  userId: string;
  courseId: string | null;
  mode: TutoringMode | null;
  title: string;
  isPinned: boolean;
  isShared: boolean;
  shareExpiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSessionDTO {
  userId: string;
  courseId: string;
  mode: TutoringMode | null;
  title: string;
}

export interface UpdateSessionDTO {
  title?: string;
  mode?: TutoringMode;
  isPinned?: boolean;
  isShared?: boolean;
  shareExpiresAt?: Date | null;
}
```

Note: Remove the `Course` import since we now store `courseId` instead of the full object.

**Step 2: Update SessionRepository**

In `src/lib/repositories/SessionRepository.ts`:

1. Remove the `SessionRow` interface's `course` field, replace with `course_id: string | null`
2. Update `mapToEntity` to map `course_id` to `courseId`
3. Update `create` to use `course_id: dto.courseId` instead of `course: dto.course`

Updated `SessionRow`:

```typescript
interface SessionRow {
  id: string;
  user_id: string;
  course_id: string | null;
  mode: string | null;
  title: string;
  is_pinned: boolean;
  is_shared: boolean;
  share_expires_at: string | null;
  created_at: string;
  updated_at: string;
}
```

Updated `mapToEntity`:

```typescript
private mapToEntity(row: SessionRow): SessionEntity {
  return {
    id: row.id,
    userId: row.user_id,
    courseId: row.course_id,
    mode: row.mode as SessionEntity['mode'],
    title: row.title,
    isPinned: row.is_pinned,
    isShared: row.is_shared,
    shareExpiresAt: row.share_expires_at ? new Date(row.share_expires_at) : null,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}
```

Updated `create`:

```typescript
async create(dto: CreateSessionDTO): Promise<SessionEntity> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('chat_sessions')
    .insert({
      user_id: dto.userId,
      course_id: dto.courseId,
      mode: dto.mode,
      title: dto.title,
      is_pinned: false,
      is_shared: false,
    })
    .select()
    .single();

  if (error) throw new DatabaseError(`Failed to create session: ${error.message}`, error);
  return this.mapToEntity(data as SessionRow);
}
```

**Step 3: Commit**

```bash
git add src/lib/domain/models/Session.ts src/lib/repositories/SessionRepository.ts
git commit -m "refactor(db): normalize session from embedded course JSON to course_id FK"
```

---

### Task 14: Update Chat Actions & Session Service

**Files:**

- Modify: `src/app/actions/chat.ts` — change `courseSchema` from object to `courseId` string
- Modify: `src/lib/services/SessionService.ts` — update `createSession` to pass `courseId`
- Modify: `src/lib/services/ChatService.ts` — update course resolution for LLM context

**Step 1: Update chat.ts**

Replace the `courseSchema` object validation:

```typescript
// Old:
const courseSchema = z.object({
  id: z.string().min(1),
  universityId: z.string().min(1),
  code: z.string().min(1),
  name: z.string().min(1),
});

// New:
const courseIdSchema = z.string().uuid();
```

Update all schemas that reference `course` to use `courseId` instead. The `generateChatSchema` should validate `courseId: courseIdSchema` instead of `course: courseSchema`.

Update `createSession` action to pass `courseId` string instead of course object.

**Step 2: Update SessionService**

Update `createSession` method to accept `courseId: string` instead of `course: Course`.

**Step 3: Update ChatService**

The `ChatService.generateResponse` needs the course context for LLM prompts (code, name, etc.). It should now resolve the course from DB:

```typescript
// In ChatService.generateResponse:
const courseService = getCourseService();
const course = courseId ? await courseService.getCourseById(courseId) : null;
// Use course.code, course.name in the LLM prompt context
```

**Step 4: Commit**

```bash
git add src/app/actions/chat.ts src/lib/services/SessionService.ts src/lib/services/ChatService.ts
git commit -m "refactor(chat): update session and chat to use courseId FK"
```

---

### Task 15: Update types/index.ts

**Files:**

- Modify: `src/types/index.ts`

**Step 1: Update ChatSession type**

Change `course: Course` to `courseId: string | null`:

```typescript
export interface ChatSession {
  id: string;
  courseId: string | null;
  mode: TutoringMode | null;
  title: string;
  messages: ChatMessage[];
  lastUpdated: number;
  isPinned?: boolean;
  isShared?: boolean;
}
```

Keep the `University` and `Course` types since they're still useful as view models (returned by the API).

**Step 2: Fix all downstream references**

Components that reference `session.course.code` or `session.course.name` need to resolve via the course data. The implementing agent should search for `session.course` across the codebase and update each reference.

Key files likely affected:

- `src/components/Sidebar.tsx` (if session titles show course info)
- `src/components/chat/` components
- Any component that displays session course info

**Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "refactor(ui): update ChatSession type to use courseId"
```

---

### Task 16: Update Consumer Components

**Files:**

- Modify: `src/components/NewSessionModal.tsx`
- Modify: `src/components/MockExamModal.tsx`
- Modify: `src/app/(protected)/exam/ExamEntryClient.tsx`
- Modify: `src/components/rag/FileUploader.tsx`
- Modify: `src/app/(protected)/admin/knowledge/KnowledgeClient.tsx`

**Step 1: Update NewSessionModal**

1. Remove `import { COURSES, UNIVERSITIES } from '../constants/index'`
2. Add `import { useCourseData } from '@/hooks/useCourseData'`
3. Replace `UNIVERSITIES` and `COURSES` references with hook data
4. Add loading state handling

Key changes:

```typescript
const {
  universities,
  courses: filteredCourses,
  isLoading: isLoadingData,
} = useCourseData(selectedUniId);

// Replace UNIVERSITIES.map with universities.map
// Replace COURSES.filter with filteredCourses (already filtered by hook)
// Replace COURSES.find with allCourses.find or filteredCourses.find
// Replace COURSES.some with allCourses.some

// The Select data props change to:
// Universities: universities.map(u => ({ value: u.id, label: u.name }))
// Courses: filteredCourses.map(c => ({ value: c.id, label: `${c.code}: ${c.name}` }))
```

The `onStart` callback signature changes from `(course: Course, mode: TutoringMode)` to `(courseId: string, mode: TutoringMode)`.

**Step 2: Update MockExamModal**

Same pattern — replace static imports with `useCourseData` hook. This component uses `courseCode` for API calls, so it needs to find course by ID then use `.code`.

**Step 3: Update ExamEntryClient**

Same pattern.

**Step 4: Update FileUploader**

Same pattern. This component extracts `shortName` and `code` from the selected university/course objects — use the hook's data arrays and `.find()`.

**Step 5: Update KnowledgeClient**

Same pattern.

**Step 6: Commit**

```bash
git add src/components/NewSessionModal.tsx src/components/MockExamModal.tsx src/app/(protected)/exam/ExamEntryClient.tsx src/components/rag/FileUploader.tsx src/app/(protected)/admin/knowledge/KnowledgeClient.tsx
git commit -m "refactor(ui): replace hardcoded constants with useCourseData hook"
```

---

### Task 17: Update Study Page & Parent Components

**Files:**

- Check and update any parent component that calls `onStart(course, mode)` to handle the new `courseId` signature
- Specifically: `src/app/(protected)/study/StudyClient.tsx` or similar

The implementing agent should:

1. Search for `onStart` prop references connected to `NewSessionModal`
2. Update the callback to pass `courseId` string to `SessionService.createSession`
3. Verify the full flow: modal → parent → action → service → repo

**Step 1: Commit**

```bash
git add -A
git commit -m "refactor(ui): update parent components for courseId flow"
```

---

### Task 18: Cleanup — Delete Constants

**Files:**

- Delete: `src/constants/index.ts`

**Step 1: Delete the file**

```bash
rm src/constants/index.ts
```

**Step 2: Verify no remaining imports**

Search for any remaining `from '@/constants/index'` or `from '../constants/index'` imports. Remove all of them.

Run: `grep -r "constants/index" src/`
Expected: No matches.

**Step 3: Commit**

```bash
git add -A
git commit -m "chore: delete hardcoded constants/index.ts"
```

---

## Wave 4: Verification (Task 19)

### Task 19: Full Verification

**Step 1: Type check**

Run: `npx tsc --noEmit`
Expected: PASS (0 errors)

**Step 2: Lint**

Run: `npm run lint`
Expected: PASS

**Step 3: Format**

Run: `npm run format`
Expected: PASS (auto-fixes any formatting issues)

**Step 4: Build**

Run: `npm run build`
Expected: PASS

**Step 5: Tests**

Run: `npx vitest run`
Expected: PASS (existing tests should still pass)

**Step 6: Final commit (if formatting changed anything)**

```bash
git add -A
git commit -m "style: format after dynamic courses migration"
```

---

## Summary

| Wave | Tasks | Description                                                                  |
| ---- | ----- | ---------------------------------------------------------------------------- |
| 1    | 1–7   | SQL migration, database types, domain models, repos, service, server actions |
| 2    | 8–11  | Query keys, useCourseData hook, i18n, sidebar link                           |
| 3    | 12–18 | Admin UI, session schema normalization, 5 component migrations, cleanup      |
| 4    | 19    | Type-check, lint, build, test verification                                   |

**Total:** 19 tasks across 4 waves. Backend first (Waves 1-2), then frontend (Wave 3), then verify (Wave 4).
