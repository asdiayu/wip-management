// ==================================================================================
// UPLOAD APK EDGE FUNCTION
// Upload file ke bucket app-releases dengan service role (bypass RLS)
// ==================================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-jwt',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('authorization') || ''
    const headerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
    const userToken = req.headers.get('x-user-jwt') || headerToken
    if (!userToken) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceKey)

    // Validate user + role (admin only)
    const { data: userRes, error: userErr } = await supabase.auth.getUser(userToken)
    if (userErr || !userRes?.user) {
      return new Response(JSON.stringify({ error: 'Invalid user' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const role = userRes.user.app_metadata?.role || userRes.user.user_metadata?.role
    if (role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const form = await req.formData()
    const file = form.get('file') as File | null
    const version = (form.get('version') as string | null) || 'latest'
    if (!file) {
      return new Response(JSON.stringify({ error: 'File required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const ext = (file.name.split('.').pop() || 'apk').toLowerCase()
    const safeVersion = version.replace(/[^0-9A-Za-z_.-]/g, '_')
    const fileName = `storage-v${safeVersion.replace(/\./g, '_')}.${ext}`

    const bytes = new Uint8Array(await file.arrayBuffer())
    const { error: uploadErr } = await supabase.storage
      .from('app-releases')
      .upload(fileName, bytes, {
        contentType: file.type || 'application/vnd.android.package-archive',
        upsert: true,
      })

    if (uploadErr) {
      return new Response(JSON.stringify({ error: uploadErr.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: { publicUrl } } = supabase.storage
      .from('app-releases')
      .getPublicUrl(fileName)

    return new Response(JSON.stringify({ success: true, publicUrl, fileName }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message || 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
