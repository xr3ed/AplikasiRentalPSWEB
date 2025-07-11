export default function Home() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {/* TV Status Cards will be mapped here */}
        <div className="bg-gray-800 p-4 rounded-lg shadow-lg">
          <h2 className="text-xl font-bold text-red-500">TV 01</h2>
          <p className="text-gray-400">Status: <span className="text-green-400">Aktif</span></p>
          <p className="text-gray-400">Sisa Waktu: 50:12</p>
          <div className="mt-4 flex space-x-2">
            <button className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded">
              Stop
            </button>
            <button className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
              Tambah Waktu
            </button>
          </div>
        </div>
        <div className="bg-gray-800 p-4 rounded-lg shadow-lg">
          <h2 className="text-xl font-bold text-red-500">TV 02</h2>
          <p className="text-gray-400">Status: <span className="text-gray-500">Mati</span></p>
          <p className="text-gray-400">Sisa Waktu: -</p>
           <div className="mt-4 flex space-x-2">
            <button className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded">
              Mulai
            </button>
          </div>
        </div>
        {/* Add more TV cards as needed */}
      </div>
    </div>
  );
}
