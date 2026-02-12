// ==================================================================================
// DAILY BACKUP EDGE FUNCTION
// Dipanggil otomatis setiap jam 7 pagi oleh pg_cron
// Melakukan backup database ke storage bucket
// ==================================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify authorization (using service role key for scheduled jobs)
    const authHeader = req.headers.get('authorization')
    if (!authHeader || !authHeader.includes('Bearer')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log('🔄 Starting daily backup process...')

    // Get current date
    const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

    const backupFilename = `backup_${today}.json`
    const oldBackupFilename = `backup_${yesterday}.json`

    console.log(`📅 Backup date: ${today}`)
    console.log(`📁 Filename: ${backupFilename}`)

    // 1. Generate backup data by calling RPC function
    const { data: backupData, error: rpcError } = await supabase
      .rpc('generate_backup_json')

    if (rpcError) {
      console.error('❌ RPC Error:', rpcError)
      throw new Error(`Failed to generate backup: ${rpcError.message}`)
    }

    if (!backupData) {
      throw new Error('No backup data generated')
    }

    console.log('✅ Backup JSON generated')

    // 2. Delete old backup (yesterday's file) if exists
    const { error: deleteError } = await supabase
      .storage
      .from('database-backups')
      .remove([oldBackupFilename])

    if (deleteError) {
      console.warn(`⚠️ Could not delete old backup: ${deleteError.message}`)
      // Continue anyway - file might not exist
    } else {
      console.log(`🗑️ Old backup deleted: ${oldBackupFilename}`)
    }

    // 3. Upload new backup to storage
    const { error: uploadError } = await supabase
      .storage
      .from('database-backups')
      .upload(backupFilename, backupData, {
        contentType: 'application/json',
        upsert: true // Overwrite if exists
      })

    if (uploadError) {
      console.error('❌ Upload Error:', uploadError)
      throw new Error(`Failed to upload backup: ${uploadError.message}`)
    }

    console.log(`✅ Backup uploaded successfully: ${backupFilename}`)

    // 4. Get file size for logging
    const { data: fileData } = await supabase
      .storage
      .from('database-backups')
      .getPublicUrl(backupFilename)

    // 5. Log activity to audit_logs (create a system user entry)
    const fileSize = new Blob([backupData]).size
    const fileSizeKB = (fileSize / 1024).toFixed(2)

    await supabase.from('audit_logs').insert({
      timestamp: new Date().toISOString(),
      user_email: 'system@backup',
      action: 'AUTO_BACKUP_SUCCESS',
      details: `Daily backup completed: ${backupFilename} (${fileSizeKB} KB)`
    })

    console.log(`📊 Size: ${fileSizeKB} KB`)
    console.log('✅ Daily backup completed successfully!')

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Daily backup completed successfully',
        data: {
          filename: backupFilename,
          size: `${fileSizeKB} KB`,
          date: today,
          publicUrl: fileData.publicUrl
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Backup failed:', error)

    // Log failure
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      const supabase = createClient(supabaseUrl, supabaseServiceKey)

      await supabase.from('audit_logs').insert({
        timestamp: new Date().toISOString(),
        user_email: 'system@backup',
        action: 'AUTO_BACKUP_FAILED',
        details: `Backup failed: ${error.message}`
      })
    } catch (logError) {
      console.error('Failed to log error:', logError)
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
