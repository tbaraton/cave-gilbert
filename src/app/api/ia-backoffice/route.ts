import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  // Test: lister toutes les variables d'env disponibles
  const allEnvKeys = Object.keys(process.env).filter(k => k.includes('ANTHROP') || k.includes('API'))
  
  return NextResponse.json({ 
    answer: `Variables trouvées: ${allEnvKeys.join(', ') || 'AUCUNE'}`, 
    sql: null 
  })
}