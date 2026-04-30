import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/utils/supabase/admin';
import { getServerInternalUser } from '@/lib/auth';
import { tienePermiso } from '@/modules/auth/repos/permissions';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await getServerInternalUser();
    if (!user || !tienePermiso(user, 'sync.ejecutar')) {
      return NextResponse.json({ ok: false, error: 'No tienes permisos para ejecutar la sincronización.' }, { status: 403 });
    }

    console.log('--- Disparando Sincronización vía Edge Function ---');
    
    // Invocamos la función directamente en Supabase
    // Esto permite que el proceso sea independiente del servidor de Next.js
    const { data, error } = await supabaseAdmin.functions.invoke('gesu-sync', {
      method: 'GET',
    });

    if (error) {
      console.error('Error invocando Edge Function:', error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ 
      ok: true, 
      mensaje: 'Sincronización iniciada correctamente en Supabase',
      data 
    });
    
  } catch (error: any) {
    console.error('Error en API Proxy de Sincronización:', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

