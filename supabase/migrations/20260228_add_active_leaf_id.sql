ALTER TABLE chat_sessions
  ADD COLUMN active_leaf_id uuid DEFAULT NULL
    REFERENCES chat_messages(id) ON DELETE SET NULL;
