'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'

export interface CartItem {
  id: string          // product_id
  nom: string
  millesime: number | null
  couleur: string
  prix_unitaire_ttc: number
  quantite: number
  stock_total: number // pour vérifier la dispo
  image_url?: string | null
  slug: string
}

interface CartContextType {
  items: CartItem[]
  totalItems: number
  totalTTC: number
  fraisPort: number
  totalAvecPort: number
  addItem: (item: Omit<CartItem, 'quantite'>) => void
  removeItem: (id: string) => void
  updateQuantite: (id: string, quantite: number) => void
  clearCart: () => void
  isOpen: boolean
  openCart: () => void
  closeCart: () => void
}

const CartContext = createContext<CartContextType | null>(null)

const FRANCO_PORT = 90    // Livraison gratuite dès 90€
const FRAIS_PORT  = 6.90  // Frais de port fixes

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  // Hydratation depuis localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('cdg_cart')
      if (saved) setItems(JSON.parse(saved))
    } catch {}
    setHydrated(true)
  }, [])

  // Persistance dans localStorage
  useEffect(() => {
    if (!hydrated) return
    try {
      localStorage.setItem('cdg_cart', JSON.stringify(items))
    } catch {}
  }, [items, hydrated])

  const totalItems = items.reduce((acc, i) => acc + i.quantite, 0)
  const totalTTC = items.reduce((acc, i) => acc + i.prix_unitaire_ttc * i.quantite, 0)
  const fraisPort = totalTTC >= FRANCO_PORT ? 0 : FRAIS_PORT
  const totalAvecPort = totalTTC + fraisPort

  const addItem = useCallback((item: Omit<CartItem, 'quantite'>) => {
    setItems(prev => {
      const existing = prev.find(i => i.id === item.id)
      if (existing) {
        // Ne pas dépasser le stock
        const newQte = Math.min(existing.quantite + 1, item.stock_total)
        return prev.map(i => i.id === item.id ? { ...i, quantite: newQte } : i)
      }
      return [...prev, { ...item, quantite: 1 }]
    })
    setIsOpen(true)
  }, [])

  const removeItem = useCallback((id: string) => {
    setItems(prev => prev.filter(i => i.id !== id))
  }, [])

  const updateQuantite = useCallback((id: string, quantite: number) => {
    if (quantite <= 0) {
      setItems(prev => prev.filter(i => i.id !== id))
      return
    }
    setItems(prev => prev.map(i => {
      if (i.id !== id) return i
      return { ...i, quantite: Math.min(quantite, i.stock_total) }
    }))
  }, [])

  const clearCart = useCallback(() => {
    setItems([])
  }, [])

  return (
    <CartContext.Provider value={{
      items, totalItems, totalTTC, fraisPort, totalAvecPort,
      addItem, removeItem, updateQuantite, clearCart,
      isOpen, openCart: () => setIsOpen(true), closeCart: () => setIsOpen(false),
    }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}

export { FRANCO_PORT, FRAIS_PORT }