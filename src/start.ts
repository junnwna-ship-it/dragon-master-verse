import { createStart } from "@tanstack/react-start";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

/**
 * Global Start instance. The client-side `attachSupabaseAuth` middleware puts
 * the Supabase bearer token on every server-function RPC so functions guarded
 * by `requireSupabaseAuth` (quiz grading, payments, scanning) don't 401.
 */
export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
}));
