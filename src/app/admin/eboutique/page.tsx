import { redirect } from 'next/navigation'

// /admin/eboutique → redirige vers la première sous-page (badges)
export default function EboutiqueIndex() {
  redirect('/admin/eboutique/badges')
}
