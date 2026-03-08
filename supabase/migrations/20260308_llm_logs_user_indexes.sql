-- Add missing indexes for per-user LLM log queries
create index if not exists idx_llm_logs_user_id
  on llm_call_logs(user_id);

create index if not exists idx_llm_logs_user_created
  on llm_call_logs(user_id, created_at desc);

-- Per-user cost summary function
create or replace function get_user_llm_cost_summary(
  start_time timestamptz,
  end_time   timestamptz default now()
)
returns table (
  user_id       uuid,
  email         text,
  full_name     text,
  total_calls   bigint,
  error_calls   bigint,
  input_tokens  bigint,
  output_tokens bigint,
  total_cost    numeric
)
language sql stable
as $$
  select
    l.user_id,
    p.email,
    p.full_name,
    count(*)::bigint                                      as total_calls,
    count(*) filter (where l.status = 'error')::bigint    as error_calls,
    coalesce(sum(l.input_tokens)::bigint, 0)              as input_tokens,
    coalesce(sum(l.output_tokens)::bigint, 0)             as output_tokens,
    coalesce(sum(l.cost_estimate), 0)                     as total_cost
  from llm_call_logs l
  left join profiles p on p.id = l.user_id
  where l.created_at >= start_time
    and l.created_at <= end_time
    and l.user_id is not null
  group by l.user_id, p.email, p.full_name
  order by total_cost desc;
$$;
