import { redirect } from 'next/navigation'

// / → /boutique : la home est directement le catalogue de la cave
export default function Home() {
  redirect('/boutique')
}
