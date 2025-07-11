package com.example.helperandroidtv

import android.graphics.Bitmap
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.View
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.google.zxing.BarcodeFormat
import com.google.zxing.MultiFormatWriter
import com.journeyapps.barcodescanner.BarcodeEncoder
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.net.ConnectivityManager
import android.net.wifi.WifiManager
import android.provider.Settings
import android.net.Uri
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetAddress
import android.widget.FrameLayout

class MainActivity : AppCompatActivity() {

    private lateinit var qrCodeImageView: ImageView
    private lateinit var statusTextView: TextView
    private lateinit var mainLayout: LinearLayout
    private lateinit var manualIpLayout: LinearLayout
    private lateinit var ipAddressInput: android.widget.EditText
    private lateinit var connectButton: android.widget.Button

    private val client = OkHttpClient()
    private var tvId: Int? = null
    private var pollingJob: Job? = null



    private var serverBaseUrl: String? = null
    private var networkScanJob: Job? = null
    private lateinit var sharedPreferences: SharedPreferences
    private var isPaired: Boolean = false

    companion object {
        private const val OVERLAY_PERMISSION_REQUEST_CODE = 1234
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        if (Settings.canDrawOverlays(this)) {
            // Izin sudah diberikan, lanjutkan dengan inisialisasi
            initializeView()
        } else {
            // Minta izin
            val intent = Intent(
                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:$packageName")
            )
            startActivityForResult(intent, OVERLAY_PERMISSION_REQUEST_CODE)
        }
    }

    private fun initializeView() {
        setContentView(R.layout.activity_main)

        qrCodeImageView = findViewById(R.id.qr_code_image_view)
        statusTextView = findViewById(R.id.status_text_view)
        mainLayout = findViewById(R.id.main_layout)
        manualIpLayout = findViewById(R.id.manual_ip_layout)
        ipAddressInput = findViewById(R.id.ip_address_input)
        connectButton = findViewById(R.id.connect_button)

        sharedPreferences = getSharedPreferences("NetworkPrefs", Context.MODE_PRIVATE)

        tvId = sharedPreferences.getInt("tvId", -1).takeIf { it != -1 }

        connectButton.setOnClickListener {
            val manualIp = ipAddressInput.text.toString()
            if (manualIp.isNotEmpty()) {
                manualIpLayout.visibility = View.GONE
                startNetworkScan(manualIp = manualIp)
            }
        }

        val lastKnownIp = sharedPreferences.getString("lastServerIp", null)
        if (tvId != null && lastKnownIp != null) {
            serverBaseUrl = "http://$lastKnownIp:3001"
            checkTvStatus(tvId!!)
        } else {
            startNetworkScan(manualIp = lastKnownIp)
        }
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == OVERLAY_PERMISSION_REQUEST_CODE) {
            if (Settings.canDrawOverlays(this)) {
                // Izin diberikan, lanjutkan inisialisasi
                initializeView()
            } else {
                // Izin ditolak, mungkin tampilkan pesan atau tutup aplikasi
                finish()
            }
        }
    }

    private fun checkTvStatus(id: Int) {
        lifecycleScope.launch(Dispatchers.IO) {
            try {
                val request = Request.Builder().url("$serverBaseUrl/api/tvs/$id").get().build()
                client.newCall(request).execute().use { response ->
                    if (response.isSuccessful) {
                        val json = JSONObject(response.body!!.string())
                        val status = json.getString("status")
                        withContext(Dispatchers.Main) {
                            if (status == "inactive") {
                                showHomeScreen(json.getString("name"))
                            } else {
                                startPairingProcess()
                            }
                        }
                    } else {
                        withContext(Dispatchers.Main) {
                            startPairingProcess()
                        }
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    // Handle error, maybe show pairing screen
                    startPairingProcess()
                }
            }
        }
    }

    private fun showHomeScreen(tvName: String) {
        setContentView(R.layout.activity_homescreen)
        val welcomeText = findViewById<TextView>(R.id.welcome_text)
        val tvNameText = findViewById<TextView>(R.id.tv_name_text)
        val memberQrCode = findViewById<ImageView>(R.id.member_qr_code)

        tvNameText.text = tvName

        startSessionPolling(tvId!!)

        // Generate QR Code for member login
        lifecycleScope.launch {
            try {
                val memberLoginUrl = "$serverBaseUrl/members/login?tvId=$tvId"
                val bitmap = generateQrCode(memberLoginUrl)
                memberQrCode.setImageBitmap(bitmap)
            } catch (e: Exception) {
                Log.e("QR_CODE", "Failed to generate member login QR code", e)
            }
        }
    }

    private fun discoverServerWithUdp(timeout: Long = 5000): String? {
        var serverUrl: String? = null
        val socket = DatagramSocket()
        try {
            socket.broadcast = true
            socket.soTimeout = timeout.toInt()

            val message = "RENTAL_PS_DISCOVERY_REQUEST".toByteArray()
            val discoveryAddress = InetAddress.getByName("255.255.255.255") // General broadcast
            val packet = DatagramPacket(message, message.size, discoveryAddress, 1988)

            Log.d("UDP_DISCOVERY", "Sending UDP discovery broadcast...")
            socket.send(packet)

            val receiveBuffer = ByteArray(1024)
            val receivePacket = DatagramPacket(receiveBuffer, receiveBuffer.size)
            socket.receive(receivePacket) // This will block until a packet is received or timeout

            val response = String(receivePacket.data, 0, receivePacket.length)
            Log.d("UDP_DISCOVERY", "Received UDP response: $response")
            val jsonResponse = JSONObject(response)
            serverUrl = jsonResponse.getString("serverUrl")

        } catch (e: Exception) {
            Log.e("UDP_DISCOVERY", "UDP discovery failed", e)
        } finally {
            socket.close()
        }
        return serverUrl
    }

        private fun startNetworkScan(manualIp: String? = null) {
        if (networkScanJob?.isActive == true) return

        networkScanJob = lifecycleScope.launch(Dispatchers.IO) {
            // 1. Coba penemuan UDP terlebih dahulu
            withContext(Dispatchers.Main) {
                statusTextView.text = "Mencari server via UDP..."
            }
            val udpDiscoveredUrl = discoverServerWithUdp()
            if (udpDiscoveredUrl != null) {
                serverBaseUrl = udpDiscoveredUrl
                val discoveredIp = InetAddress.getByName(java.net.URL(serverBaseUrl).host).hostAddress
                sharedPreferences.edit().putString("lastServerIp", discoveredIp).apply()
                withContext(Dispatchers.Main) {
                    statusTextView.text = "Server ditemukan via UDP di $serverBaseUrl!"
                    startPairingProcess()
                }
                networkScanJob?.cancel()
                return@launch
            }

            // 2. Jika UDP gagal, coba IP yang terakhir diketahui
            if (manualIp != null) {
                withContext(Dispatchers.Main) {
                    statusTextView.text = "Mencoba menghubungkan ke $manualIp..."
                }
                val url = "http://$manualIp:3001/api/tvs/ping"
                try {
                    val request = Request.Builder().url(url).get().build()
                    client.newCall(request).execute().use { response ->
                        if (response.isSuccessful) {
                            serverBaseUrl = "http://$manualIp:3001"
                            Log.d("NETWORK_SCAN", "Server ditemukan di: $serverBaseUrl")
                            sharedPreferences.edit().putString("lastServerIp", manualIp).apply()
                            withContext(Dispatchers.Main) {
                                statusTextView.text = "Server ditemukan di $serverBaseUrl!"
                                startPairingProcess()
                            }
                            networkScanJob?.cancel()
                            return@launch
                        }
                    }
                } catch (e: Exception) {
                    // Gagal terhubung ke IP manual
                }
            }

            // 3. Jika semua gagal, lakukan pemindaian subnet penuh

            // Jika IP manual gagal atau tidak disediakan, lanjutkan dengan pemindaian otomatis
            withContext(Dispatchers.Main) {
                statusTextView.text = "Memindai jaringan untuk server..."
            }

            val localIp = getLocalIpAddress()
            if (localIp == null) {
                Log.e("NETWORK_SCAN", "Gagal mendapatkan IP lokal, membatalkan pemindaian.")
                withContext(Dispatchers.Main) {
                    statusTextView.text = "Tidak dapat menemukan alamat IP lokal. Periksa koneksi Wi-Fi."
                    manualIpLayout.visibility = View.VISIBLE
                }
                delay(10000)
                startNetworkScan() // Coba lagi
                return@launch
            }

            val subnet = localIp.substring(0, localIp.lastIndexOf('.'))
            Log.d("NETWORK_SCAN", "Memindai subnet: $subnet.0/24")

            for (i in 1..254) {
                if (!isActive) break

                val host = "$subnet.$i"
                val url = "http://$host:3001/api/tvs/ping" // Ganti port ke 3001

                if (i % 20 == 0) {
                    withContext(Dispatchers.Main) {
                        statusTextView.text = "Memindai $host..."
                    }
                }

                try {
                    val request = Request.Builder().url(url).get().build()
                    client.newCall(request).execute().use { response ->
                        if (response.isSuccessful) {
                            serverBaseUrl = "http://$host:3001"
                            Log.d("NETWORK_SCAN", "Server ditemukan di: $serverBaseUrl")
                            sharedPreferences.edit().putString("lastServerIp", host).apply()
                            withContext(Dispatchers.Main) {
                                statusTextView.text = "Server ditemukan di $serverBaseUrl!"
                                startPairingProcess()
                            }
                            networkScanJob?.cancel()
                            return@use
                        }
                    }
                } catch (e: Exception) {
                    // Lanjutkan
                }
            }

            if (isActive) {
                withContext(Dispatchers.Main) {
                    statusTextView.text = "Server tidak ditemukan. Masukkan IP secara manual atau coba lagi."
                    manualIpLayout.visibility = View.VISIBLE
                }
            }
        }
    }

    private fun getLocalIpAddress(): String? {
        try {
            val wifiManager = applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
            val ipAddress = wifiManager.connectionInfo.ipAddress
            if (ipAddress == 0) return null
            return String.format(
                "%d.%d.%d.%d",
                ipAddress and 0xff,
                ipAddress shr 8 and 0xff,
                ipAddress shr 16 and 0xff,
                ipAddress shr 24 and 0xff
            )
        } catch (ex: Exception) {
            Log.e("IP_ADDRESS", "Gagal mendapatkan alamat IP", ex)
        }
        return null
    }

    override fun onPause() {
        super.onPause()
        networkScanJob?.cancel()
    }

    override fun onResume() {
        super.onResume()
        if (serverBaseUrl == null) {
            startNetworkScan()
        }
    }

    private fun startPairingProcess() {
        if (serverBaseUrl == null) {
            statusTextView.text = "Server belum ditemukan. Pastikan server berjalan dan berada di jaringan yang sama."
            return
        }

        lifecycleScope.launch(Dispatchers.IO) {
            try {
                val emptyJson = "{}"
                val body = emptyJson.toRequestBody("application/json; charset=utf-8".toMediaType())
                val request = Request.Builder()
                    .url("$serverBaseUrl/api/tvs")
                    .post(body)
                    .build()

                client.newCall(request).execute().use { response ->
                    if (!response.isSuccessful) {
                        val errorBody = response.body?.string() ?: "No response body"
                        throw Exception("Failed to create TV: ${response.code} ${response.message}\n$errorBody")
                    }

                    val responseData = response.body?.string()
                    if (responseData == null) {
                        throw Exception("Received empty response from server")
                    }

                    val jsonObject = JSONObject(responseData)
                    tvId = jsonObject.getInt("id")

                    // Now, fetch the QR code for the newly created TV
                    fetchAndDisplayQRCode(tvId!!)
                    startPollingForPairingStatus(tvId!!)
                }
            } catch (e: Exception) {
                Log.e("PAIRING_ERROR", "Error creating TV", e)
                withContext(Dispatchers.Main) {
                    statusTextView.text = "Gagal memulai proses pairing: ${e.message}"
                }
            }
        }
    }

    private fun fetchAndDisplayQRCode(tvId: Int) {
        lifecycleScope.launch(Dispatchers.IO) {
            try {
                val request = Request.Builder()
                    .url("$serverBaseUrl/api/tvs/$tvId/qrcode")
                    .get()
                    .build()

                client.newCall(request).execute().use { response ->
                    if (!response.isSuccessful) {
                        throw Exception("Failed to fetch QR code: ${response.code}")
                    }
                    val responseData = response.body?.string() ?: throw Exception("Empty QR code response")
                    val jsonObject = JSONObject(responseData)
                    val qrCodeData = jsonObject.getString("qrCode")

                    withContext(Dispatchers.Main) {
                        statusTextView.text = "TV berhasil dibuat. Memuat QR Code..."
                        displayQrCodeFromBase64(qrCodeData)
                    }
                }
            } catch (e: Exception) {
                Log.e("QR_CODE_ERROR", "Error fetching QR code", e)
                withContext(Dispatchers.Main) {
                    statusTextView.text = "Gagal memuat QR code: ${e.message}"
                }
            }
        }
    }

    private fun displayQrCodeFromBase64(qrCodeBase64: String) {
        lifecycleScope.launch(Dispatchers.IO) {
            try {
                // Asumsi qrCodeUrl adalah data URL base64
                val imageBytes = android.util.Base64.decode(qrCodeBase64.substringAfter(","), android.util.Base64.DEFAULT)
                val decodedImage = android.graphics.BitmapFactory.decodeByteArray(imageBytes, 0, imageBytes.size)

                withContext(Dispatchers.Main) {
                    qrCodeImageView.setImageBitmap(decodedImage)
                    statusTextView.text = "Pindai QR code ini untuk memasangkan TV."
                }
            } catch (e: Exception) {
                Log.e("QR_CODE_ERROR", "Error displaying QR code from URL", e)
                withContext(Dispatchers.Main) {
                    statusTextView.text = "Gagal menampilkan QR code."
                }
            }
        }
    }

    private fun startSessionPolling(id: Int) {
        pollingJob = lifecycleScope.launch(Dispatchers.IO) {
            while (isActive) {
                try {
                    val request = Request.Builder().url("$serverBaseUrl/api/tvs/$id").get().build()
                    client.newCall(request).execute().use { response ->
                        if (response.isSuccessful) {
                            val json = JSONObject(response.body!!.string())
                            val status = json.getString("status")
                            withContext(Dispatchers.Main) {
                                if (status == "active") {
                                    // Move the task to the background, simulating minimizing the app
                                    moveTaskToBack(true)
                                } else {
                                    // The app is on the homescreen, but not active, so we bring it to the front.
                                    val intent = Intent(this@MainActivity, MainActivity::class.java)
                                    intent.addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
                                    startActivity(intent)
                                }
                            }
                        }
                    }
                } catch (e: Exception) {
                    Log.e("SESSION_POLL", "Error polling for session status", e)
                }
                delay(5000) // Poll every 5 seconds
            }
        }
    }

    private suspend fun generateQrCode(text: String): Bitmap = withContext(Dispatchers.Default) {
        val multiFormatWriter = MultiFormatWriter()
        val bitMatrix = multiFormatWriter.encode(text, BarcodeFormat.QR_CODE, 400, 400)
        val barcodeEncoder = BarcodeEncoder()
        barcodeEncoder.createBitmap(bitMatrix)
    }

    private fun startPollingForPairingStatus(tvId: Int) {
        pollingJob = lifecycleScope.launch(Dispatchers.IO) {
            while (isActive) {
                try {
                    val request = Request.Builder()
                        .url("$serverBaseUrl/api/tvs/$tvId")
                        .get()
                        .build()

                    client.newCall(request).execute().use { response ->
                        if (response.isSuccessful) {
                            val responseData = response.body?.string()
                            val jsonObject = JSONObject(responseData)
                            val status = jsonObject.getString("status")
                            val name = jsonObject.getString("name")

                            if (status != "pairing") {
                                withContext(Dispatchers.Main) {
                                    statusTextView.text = "TV berhasil dipasangkan dengan nama: $name"
                                    // Save the paired TV ID
                                    sharedPreferences.edit().putInt("tvId", tvId).apply()
                                    pollingJob?.cancel() // Stop polling
                                    showHomeScreen(name) // Pindah ke homescreen
                                }
                            }
                        } else {
                            // Handle non-successful responses if needed
                            Log.w("POLLING_WARN", "Polling check failed with code: ${response.code}")
                        }
                    }
                } catch (e: Exception) {
                    Log.e("POLLING_ERROR", "Error during polling", e)
                    // Optional: Decide if you want to stop polling on error
                }
                delay(5000) // Poll every 5 seconds
            }
        }
    }
}