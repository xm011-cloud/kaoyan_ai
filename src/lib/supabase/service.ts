import { createClient } from "@supabase/supabase-js";
import { envConfig } from '@/lib/env-config'

export function createServiceClient() {
  return createClient(
    envConfig.projectUrl,
    envConfig.serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
