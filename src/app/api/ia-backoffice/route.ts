import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const key = process.env.ANTHROPIC_API_KEY
  return NextResponse.json({ 
    answer: `Type: ${typeof key}, Longueur: ${key?.length}, Valeur brute: "${key?.slice(0,20)}"`,
    sql: null
  })
}