-- Create assignments table (parent for assignment domain)
create table if not exists assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  school text,
  course text,
  status text not null default 'parsing',
  status_message text,
  created_at timestamptz default now()
);

alter table assignments enable row level security;
create policy "Users can manage own assignments"
  on assignments for all using (auth.uid() = user_id);

-- Create assignment_items table
create table if not exists assignment_items (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references assignments(id) on delete cascade,
  order_num int not null,
  type text not null default '',
  content text not null,
  reference_answer text not null default '',
  explanation text not null default '',
  points int not null default 0,
  difficulty text not null default '',
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

alter table assignment_items enable row level security;
create policy "Users can manage own assignment items"
  on assignment_items for all
  using (exists (
    select 1 from assignments
    where assignments.id = assignment_items.assignment_id
      and assignments.user_id = auth.uid()
  ));
