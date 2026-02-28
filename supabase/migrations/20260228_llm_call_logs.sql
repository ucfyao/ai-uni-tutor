create table if not exists llm_call_logs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references profiles(id) on delete set null,
  call_type     text not null default 'unknown',
  provider      text not null,
  model         text not null,
  status        text not null default 'success',
  error_message text,
  latency_ms    integer not null,
  input_tokens  integer,
  output_tokens integer,
  cost_estimate numeric(10,6),
  metadata      jsonb default '{}',
  created_at    timestamptz not null default now()
);

create index idx_llm_logs_created on llm_call_logs(created_at desc);
create index idx_llm_logs_status  on llm_call_logs(status) where status = 'error';
create index idx_llm_logs_type    on llm_call_logs(call_type);
