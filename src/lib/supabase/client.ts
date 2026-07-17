import { createBrowserClient } from '@supabase/ssr'
import { envConfig } from '@/lib/env-config'

export function createClient() {
  return createBrowserClient(
    envConfig.projectUrl,
    envConfig.anonKey,
  )
}
