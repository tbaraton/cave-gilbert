export default function Home() {
  return (
    <main style={{ 
      display: 'flex', 
      flexDirection: 'column',
      alignItems: 'center', 
      justifyContent: 'center', 
      minHeight: '100vh',
      backgroundColor: '#0d0a08',
      color: '#c9a96e',
      fontFamily: 'Georgia, serif'
    }}>
      <h1 style={{ fontSize: '3rem', marginBottom: '1rem' }}>Cave de Gilbert</h1>
      <p style={{ color: '#e8e0d5' }}>Site en construction — bientôt disponible</p>
    </main>
  )
}