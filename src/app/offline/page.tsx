'use client'

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center max-w-sm p-8">
        <div className="text-5xl mb-4">📡</div>
        <h1 className="text-xl font-bold text-gray-800 mb-2">Sin conexión</h1>
        <p className="text-gray-500 text-sm mb-6">
          No hay conexión a internet. Cuando te reconectes, la app se actualizará automáticamente.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          Intentar de nuevo
        </button>
      </div>
    </div>
  )
}
