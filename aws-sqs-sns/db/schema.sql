CREATE TABLE IF NOT EXISTS public.orders (
  order_id TEXT PRIMARY KEY,
  customer_name TEXT NOT NULL CHECK (btrim(customer_name) <> ''),
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  status TEXT NOT NULL CHECK (btrim(status) <> ''),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
