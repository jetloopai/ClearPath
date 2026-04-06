-- Migration: Add user_id to analyses table for Saved Deals Dashboard

ALTER TABLE public.analyses
ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX idx_analyses_user_id ON public.analyses(user_id);
