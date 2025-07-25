package com.example.helperandroidtv

import android.graphics.Bitmap
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.View
import android.widget.Button
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
import android.content.BroadcastReceiver
import android.content.IntentFilter
import android.net.ConnectivityManager
import android.net.wifi.WifiManager
import android.provider.Settings
import android.net.Uri
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import io.socket.client.IO
import io.socket.client.Socket
import io.socket.emitter.Emitter
import java.net.URISyntaxException
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

    private lateinit var statusTextView: TextView
    private lateinit var mainLayout: LinearLayout
    private lateinit var manualIpLayout: LinearLayout
    private lateinit var ipAddressInput: android.widget.EditText
    private lateinit var connectButton: android.widget.Button

    private val client = OkHttpClient()
    private var tvId: Int? = null
    private var pollingJob: Job? = null
    private var currentLoginCode: String? = null
    private var lastSessionStatus: String? = null

    // Socket.IO variables
    private var socket: Socket? = null
    private var useSocketIO: Boolean = true // Flag to enable/disable Socket.IO

    // Heartbeat variables for monitoring
    private var heartbeatJob: Job? = null
    private val heartbeatIntervalMs = 30000L // 30 seconds



    private var serverBaseUrl: String? = null
    private var networkScanJob: Job? = null
    private lateinit var sharedPreferences: SharedPreferences
    private var isPaired: Boolean = false

    // TV ID Broadcast Receiver
    private var tvIdReceiver: BroadcastReceiver? = null
    private var tvIdConfiguredReceiver: BroadcastReceiver? = null

    companion object {
        private const val OVERLAY_PERMISSION_REQUEST_CODE = 1234
        private const val TV_ID_BROADCAST_ACTION = "com.example.helperandroidtv.SET_TV_ID"
        private const val TV_ID_CONFIGURED_ACTION = "com.example.helperandroidtv.TV_ID_CONFIGURED"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Set up global error handler
        val defaultHandler = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler(GlobalExceptionHandler(this, defaultHandler!!))

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

        // Register broadcast receiver for TV ID configuration
        registerTvIdReceiver()

        val lastKnownIp = sharedPreferences.getString("lastServerIp", null)
        if (tvId != null && lastKnownIp != null) {
            serverBaseUrl = "http://$lastKnownIp:3001"
            checkTvStatus(tvId!!)
        } else {
            // Check if we're waiting for TV ID configuration
            if (tvId == null) {
                statusTextView.text = "Menunggu konfigurasi TV ID dari server..."
                Log.i("MainActivity", "🆔 Waiting for TV ID configuration via broadcast")
            }
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
                        val tvName = json.getString("name")
                        val actualTvId = json.getInt("id")

                        // Update tvId to match server
                        tvId = actualTvId
                        sharedPreferences.edit().putInt("tvId", actualTvId).apply()

                        withContext(Dispatchers.Main) {
                            // Always show home screen, no pairing needed
                            showHomeScreen(tvName, actualTvId)
                        }
                    } else {
                        withContext(Dispatchers.Main) {
                            // TV not found on server, clear stored TV ID and show error
                            tvId = null
                            sharedPreferences.edit().remove("tvId").apply()
                            showTvNotConfiguredScreen()
                        }
                    }
                }
            } catch (e: Exception) {
                Log.e("TV_STATUS_CHECK", "Error checking TV status", e)
                withContext(Dispatchers.Main) {
                    // Handle error, show configuration needed screen
                    showTvNotConfiguredScreen()
                }
            }
        }
    }

    private fun checkTvConfiguration() {
        // Check if TV ID is already saved
        if (tvId != null && tvId != -1) {
            // TV is configured, check status on server
            checkTvStatus(tvId!!)
        } else {
            // TV not configured, try to find by IP address
            findTvByIpAddress()
        }
    }

    // NEW: Refresh configuration state - untuk auto-navigation setelah server connect
    private fun refreshConfigurationState() {
        Log.i("REFRESH_CONFIG", "🔄 Refreshing configuration state...")

        // Re-check saved TV ID
        val savedTvId = sharedPreferences.getInt("tvId", -1)
        if (savedTvId != -1) {
            tvId = savedTvId
            Log.i("REFRESH_CONFIG", "✅ Found saved TV ID: $savedTvId, checking status...")
            checkTvStatus(savedTvId)
        } else {
            Log.i("REFRESH_CONFIG", "❌ No saved TV ID, finding by IP...")
            findTvByIpAddress()
        }
    }

    private fun findTvByIpAddress() {
        val localIp = getLocalIpAddress()
        if (localIp == null) {
            showTvNotConfiguredScreen()
            return
        }

        lifecycleScope.launch(Dispatchers.IO) {
            try {
                val request = Request.Builder().url("$serverBaseUrl/api/tvs").get().build()
                client.newCall(request).execute().use { response ->
                    if (response.isSuccessful) {
                        val json = JSONObject(response.body!!.string())
                        val tvsArray = json.getJSONArray("data")

                        // Look for TV with matching IP
                        for (i in 0 until tvsArray.length()) {
                            val tvObj = tvsArray.getJSONObject(i)
                            val tvIpAddress = tvObj.getString("ip_address")

                            // Clean up IP addresses for comparison
                            val cleanLocalIp = localIp.replace("::ffff:", "")
                            val cleanTvIp = tvIpAddress.replace("::ffff:", "")

                            if (cleanLocalIp == cleanTvIp) {
                                // Found matching TV, save ID and show home screen
                                val foundTvId = tvObj.getInt("id")
                                val foundTvName = tvObj.getString("name")

                                tvId = foundTvId
                                sharedPreferences.edit().putInt("tvId", foundTvId).apply()

                                withContext(Dispatchers.Main) {
                                    showHomeScreen(foundTvName, foundTvId)
                                }
                                return@launch
                            }
                        }

                        // No matching TV found, try to update IP for existing TV ID if available
                        val savedTvId = sharedPreferences.getInt("tvId", -1)
                        if (savedTvId != -1) {
                            Log.i("FIND_TV_BY_IP", "🔄 No IP match found, trying to update IP for saved TV ID: $savedTvId")
                            tryUpdateTvIpAddress(savedTvId, localIp)
                        } else {
                            withContext(Dispatchers.Main) {
                                showTvNotConfiguredScreen()
                            }
                        }
                    } else {
                        withContext(Dispatchers.Main) {
                            showTvNotConfiguredScreen()
                        }
                    }
                }
            } catch (e: Exception) {
                Log.e("TV_IP_SEARCH", "Error finding TV by IP", e)
                withContext(Dispatchers.Main) {
                    showTvNotConfiguredScreen()
                }
            }
        }
    }

    // NEW: Try to update TV IP address
    private fun tryUpdateTvIpAddress(tvId: Int, newIpAddress: String) {
        lifecycleScope.launch(Dispatchers.IO) {
            try {
                val requestBody = JSONObject().apply {
                    put("ip_address", newIpAddress)
                }.toString().toRequestBody("application/json".toMediaType())

                val request = Request.Builder()
                    .url("$serverBaseUrl/api/tvs/$tvId/update-ip")
                    .put(requestBody)
                    .build()

                client.newCall(request).execute().use { response ->
                    if (response.isSuccessful) {
                        val json = JSONObject(response.body!!.string())
                        val updatedTv = json.getJSONObject("tv")
                        val tvName = updatedTv.getString("name")

                        Log.i("UPDATE_TV_IP", "✅ TV IP updated successfully: $tvName")

                        withContext(Dispatchers.Main) {
                            showHomeScreen(tvName, tvId)
                        }
                    } else {
                        Log.e("UPDATE_TV_IP", "❌ Failed to update TV IP: ${response.code}")
                        withContext(Dispatchers.Main) {
                            showTvNotConfiguredScreen()
                        }
                    }
                }
            } catch (e: Exception) {
                Log.e("UPDATE_TV_IP", "❌ Error updating TV IP", e)
                withContext(Dispatchers.Main) {
                    showTvNotConfiguredScreen()
                }
            }
        }
    }

    private fun showTvNotConfiguredScreen() {
        statusTextView.text = "TV belum dikonfigurasi.\n\nSilakan hubungi administrator untuk mengatur TV ini melalui ADB atau tambahkan TV secara manual di dashboard."
        mainLayout.visibility = View.VISIBLE

        // Hide manual IP layout since this is a configuration issue
        manualIpLayout.visibility = View.GONE
    }

    private fun showHomeScreen(tvName: String, tvIdParam: Int) {
        setContentView(R.layout.activity_homescreen)
        val welcomeText = findViewById<TextView>(R.id.welcome_text)
        val tvNameText = findViewById<TextView>(R.id.tv_name_text)
        val memberQrCode = findViewById<ImageView>(R.id.member_qr_code)

        tvNameText.text = tvName

        // Initialize session status tracking
        lastSessionStatus = "inactive"

        // Use Socket.IO for real-time communication, fallback to HTTP polling
        connectSocketIO(tvIdParam)

        lifecycleScope.launch {
            fetchAndDisplayLoginCode(tvIdParam)
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
                    // Refresh configuration state untuk auto-navigation
                    refreshConfigurationState()
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
                                refreshConfigurationState()
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
                                refreshConfigurationState()
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
                java.util.Locale.ROOT,
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









        private fun fetchAndDisplayLoginCode(tvId: Int) {
        lifecycleScope.launch(Dispatchers.IO) {
            try {
                val request = Request.Builder().url("$serverBaseUrl/api/tvs/$tvId/generate-login-code").post("".toRequestBody()).build()

                client.newCall(request).execute().use { response ->
                    if (response.isSuccessful) {
                        val json = JSONObject(response.body!!.string())
                        val loginCode = json.getString("code")
                        val whatsappPhoneNumber = json.getString("whatsAppNumber")
                        val whatsappMessage = "$loginCode - Jangan ubah pesan ini"
                        val whatsappUrl = "https://wa.me/$whatsappPhoneNumber?text=${Uri.encode(whatsappMessage)}"

                        // Store current login code
                        currentLoginCode = loginCode

                        val qrCodeBitmap = generateQrCode(whatsappUrl)

                        withContext(Dispatchers.Main) {
                            val memberQrCodeImageView = findViewById<ImageView>(R.id.member_qr_code)
                            memberQrCodeImageView.setImageBitmap(qrCodeBitmap)
                            memberQrCodeImageView.visibility = View.VISIBLE

                            // Sembunyikan atau hapus tampilan teks jika tidak diperlukan lagi
                            findViewById<TextView>(R.id.login_code_text).visibility = View.GONE
                            findViewById<TextView>(R.id.login_instruction_text).visibility = View.GONE
                        }


                    } else {
                        Log.e("MainActivity", "Failed to generate login code: ${response.code}")
                    }
                }
            } catch (e: Exception) {
                Log.e("MainActivity", "Error generating login code", e)
            }
        }
    }









    private fun connectSocketIO(tvId: Int) {
        if (!useSocketIO || serverBaseUrl == null) {
            Log.w("MainActivity", "Socket.IO disabled or no server URL, falling back to HTTP polling")
            startSessionPolling(tvId)
            return
        }

        try {
            val uri = serverBaseUrl!!.replace("http://", "").replace("https://", "")
            val socketUrl = "http://$uri"

            Log.i("MainActivity", "Connecting to Socket.IO server: $socketUrl")

            socket = IO.socket(socketUrl)

            socket?.on(Socket.EVENT_CONNECT) {
                Log.i("MainActivity", "Socket.IO connected successfully")

                // Send immediate connect event for instant status update
                sendImmediateConnectEvent(tvId)

                // Start regular heartbeat
                startHeartbeat(tvId)
            }

            socket?.on(Socket.EVENT_DISCONNECT) {
                Log.w("MainActivity", "Socket.IO disconnected")
                // Stop heartbeat when Socket.IO disconnects
                stopHeartbeat()
            }

            socket?.on(Socket.EVENT_CONNECT_ERROR) { args ->
                Log.e("MainActivity", "Socket.IO connection error: ${args.contentToString()}")
                // Fallback to HTTP polling on connection error
                Log.i("MainActivity", "Falling back to HTTP polling")
                startSessionPolling(tvId)
            }

            // Listen for TV-specific status events
            socket?.on("tv_status_$tvId") { args ->
                if (args.isNotEmpty()) {
                    try {
                        val data = args[0] as JSONObject
                        val type = data.getString("type")
                        val status = data.optString("status", "")  // Optional field with empty string default

                        Log.i("MainActivity", "Received Socket.IO event: $type" + if (status.isNotEmpty()) ", status: $status" else "")

                        lifecycleScope.launch(Dispatchers.Main) {
                            when (type) {
                                "session_started" -> {
                                    if (status.isNotEmpty()) {  // Add status check
                                        lastSessionStatus = status
                                        // Move app to background when session starts
                                        moveTaskToBack(true)
                                    }
                                }
                                "session_ended" -> {
                                    if (status.isNotEmpty()) {  // Add status check
                                        lastSessionStatus = status
                                        // Generate new QR code when session ends
                                        Log.i("MainActivity", "🎯 SESSION END DETECTED via Socket.IO! Generating new QR code")
                                        generateNewQrCodeAfterSession(tvId)

                                        // Bring app to front when session ends
                                        val intent = Intent(this@MainActivity, MainActivity::class.java)
                                        intent.addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
                                        startActivity(intent)
                                    }
                                }
                                "login_code_expired" -> {
                                    // Automatic QR refresh when login code expires (no status field needed)
                                    val expiredCode = data.optString("expiredCode", "")
                                    Log.i("MainActivity", "🔄 LOGIN CODE EXPIRED via Socket.IO! Code: $expiredCode - Auto-refreshing QR")
                                    generateNewQrCodeAfterSession(tvId)

                                    // Show user notification about automatic refresh
                                    showQrRefreshNotification("Auto-refreshed (expired)")
                                }
                            }
                        }
                    } catch (e: Exception) {
                        Log.e("MainActivity", "Error processing Socket.IO event", e)
                    }
                }
            }

            socket?.connect()

        } catch (e: URISyntaxException) {
            Log.e("MainActivity", "Invalid Socket.IO URI", e)
            // Fallback to HTTP polling
            startSessionPolling(tvId)
        } catch (e: Exception) {
            Log.e("MainActivity", "Socket.IO setup error", e)
            // Fallback to HTTP polling
            startSessionPolling(tvId)
        }
    }

    private fun disconnectSocketIO() {
        socket?.disconnect()
        socket?.off()
        socket = null
        stopHeartbeat()
        Log.i("MainActivity", "Socket.IO disconnected and cleaned up")
    }

    /**
     * Start sending heartbeat signals to server for monitoring
     */
    private fun startHeartbeat(tvId: Int) {
        // Stop existing heartbeat if running
        stopHeartbeat()

        heartbeatJob = lifecycleScope.launch {
            while (isActive) {
                try {
                    sendHeartbeat(tvId)
                    delay(heartbeatIntervalMs)
                } catch (e: Exception) {
                    Log.e("MainActivity", "Error in heartbeat loop: ${e.message}")
                    // Continue the loop even if one heartbeat fails
                    delay(heartbeatIntervalMs)
                }
            }
        }

        Log.i("MainActivity", "Heartbeat started for TV $tvId (interval: ${heartbeatIntervalMs/1000}s)")
    }

    /**
     * Stop heartbeat signals
     */
    private fun stopHeartbeat() {
        heartbeatJob?.cancel()
        heartbeatJob = null
        Log.i("MainActivity", "Heartbeat stopped")
    }

    /**
     * Send immediate connect event for instant status update
     */
    private fun sendImmediateConnectEvent(tvId: Int) {
        try {
            if (socket?.connected() == true) {
                val connectData = JSONObject().apply {
                    put("tvId", tvId)
                    put("timestamp", System.currentTimeMillis())
                    put("appVersion", BuildConfig.VERSION_NAME)
                    put("deviceInfo", JSONObject().apply {
                        put("model", android.os.Build.MODEL)
                        put("manufacturer", android.os.Build.MANUFACTURER)
                        put("androidVersion", android.os.Build.VERSION.RELEASE)
                    })
                }

                socket?.emit("tv-connect", connectData)
                Log.i("MainActivity", "🚀 Immediate connect event sent for TV $tvId")

                // Listen for confirmation
                socket?.on("tv-connect-confirmed") { args ->
                    if (args.isNotEmpty()) {
                        try {
                            val data = args[0] as JSONObject
                            val confirmedTvId = data.getInt("tvId")
                            if (confirmedTvId == tvId) {
                                Log.i("MainActivity", "✅ Connect confirmation received for TV $tvId")
                                runOnUiThread {
                                    // Update UI to show connected status immediately
                                    updateConnectionStatus("Connected - Active")
                                }
                            }
                        } catch (e: Exception) {
                            Log.e("MainActivity", "Error parsing connect confirmation: ${e.message}")
                        }
                    }
                }

                // Listen for connection errors
                socket?.on("tv-connect-error") { args ->
                    if (args.isNotEmpty()) {
                        try {
                            val data = args[0] as JSONObject
                            val errorTvId = data.getInt("tvId")
                            if (errorTvId == tvId) {
                                val error = data.getString("error")
                                Log.e("MainActivity", "❌ Connect error for TV $tvId: $error")
                            }
                        } catch (e: Exception) {
                            Log.e("MainActivity", "Error parsing connect error: ${e.message}")
                        }
                    }
                }

                // Listen for auto-update events
                socket?.on("tv-update-event") { args ->
                    if (args.isNotEmpty()) {
                        try {
                            val data = args[0] as JSONObject
                            val updateTvId = data.getInt("tvId")
                            if (updateTvId == tvId) {
                                val eventType = data.getString("eventType")
                                val message = data.optString("message", "")

                                Log.i("MainActivity", "🔄 Update event: $eventType - $message")

                                runOnUiThread {
                                    when (eventType) {
                                        "update-started" -> {
                                            updateConnectionStatus("🔄 Auto-update starting...")
                                        }
                                        "update-progress" -> {
                                            updateConnectionStatus("🔄 $message")
                                        }
                                        "update-completed" -> {
                                            val newVersion = data.optString("newVersion", "")
                                            updateConnectionStatus("✅ Updated to v$newVersion")

                                            // App will be restarted by ADB, so this might not be visible
                                            Log.i("MainActivity", "✅ Update completed, app may restart")
                                        }
                                        "update-failed" -> {
                                            val error = data.optString("error", "Unknown error")
                                            updateConnectionStatus("❌ Update failed: $error")
                                            Log.e("MainActivity", "❌ Update failed: $error")
                                        }
                                    }
                                }
                            }
                        } catch (e: Exception) {
                            Log.e("MainActivity", "Error parsing update event: ${e.message}")
                        }
                    }
                }
            }
        } catch (e: Exception) {
            Log.e("MainActivity", "Error sending immediate connect event: ${e.message}")
        }
    }

    /**
     * Send a single heartbeat signal to server
     */
    private fun sendHeartbeat(tvId: Int) {
        try {
            if (socket?.connected() == true) {
                // Send heartbeat via Socket.IO
                val heartbeatData = JSONObject().apply {
                    put("tvId", tvId)
                    put("timestamp", System.currentTimeMillis())
                    put("status", "alive")
                }

                socket?.emit("tv-heartbeat", heartbeatData)
                Log.d("MainActivity", "Heartbeat sent via Socket.IO for TV $tvId")

            } else if (serverBaseUrl != null) {
                // Fallback: Send heartbeat via HTTP
                lifecycleScope.launch(Dispatchers.IO) {
                    try {
                        val heartbeatData = JSONObject().apply {
                            put("tvId", tvId)
                            put("timestamp", System.currentTimeMillis())
                            put("status", "alive")
                        }

                        val body = heartbeatData.toString().toRequestBody("application/json".toMediaType())
                        val request = Request.Builder()
                            .url("$serverBaseUrl/api/tvs/$tvId/heartbeat")
                            .post(body)
                            .build()

                        client.newCall(request).execute().use { response ->
                            if (response.isSuccessful) {
                                Log.d("MainActivity", "Heartbeat sent via HTTP for TV $tvId")
                            } else {
                                Log.w("MainActivity", "Heartbeat HTTP request failed: ${response.code}")
                            }
                        }
                    } catch (e: Exception) {
                        Log.e("MainActivity", "Error sending HTTP heartbeat: ${e.message}")
                    }
                }
            }
        } catch (e: Exception) {
            Log.e("MainActivity", "Error sending heartbeat: ${e.message}")
        }
    }

    private fun startSessionPolling(id: Int) {
        // Start heartbeat for HTTP polling mode
        startHeartbeat(id)

        pollingJob = lifecycleScope.launch(Dispatchers.IO) {
            while (isActive) {
                try {
                    val request = Request.Builder().url("$serverBaseUrl/api/tvs/$id").get().build()
                    client.newCall(request).execute().use { response ->
                        if (response.isSuccessful) {
                            val json = JSONObject(response.body!!.string())
                            val status = json.getString("status")

                            // Check for session end with BOTH 'inactive' and 'off' status
                            val sessionEnded = lastSessionStatus != null && lastSessionStatus == "on" && (status == "inactive" || status == "off")

                            if (sessionEnded) {
                                // Session just ended, generate new QR code
                                Log.i("MainActivity", "🎯 SESSION END DETECTED! (Status: '$status') Generating new QR code for TV $id")
                                generateNewQrCodeAfterSession(id)
                            }

                            // Update last session status
                            lastSessionStatus = status

                            withContext(Dispatchers.Main) {
                                if (status == "on") {
                                    // Move the task to the background, simulating minimizing the app
                                    moveTaskToBack(true)
                                } else {
                                    // The app is on the homescreen, but not active, so we bring it to the front.
                                    val intent = Intent(this@MainActivity, MainActivity::class.java)
                                    intent.addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
                                    startActivity(intent)
                                }
                            }
                        } else {
                            Log.w("MainActivity", "Polling request failed: ${response.code}")
                        }
                    }
                } catch (e: Exception) {
                    Log.e("SESSION_POLL", "Error polling for session status", e)
                }

                delay(5000) // Poll every 5 seconds
            }
        }
    }

    private fun generateNewQrCodeAfterSession(tvId: Int) {
        lifecycleScope.launch(Dispatchers.IO) {
            try {
                // Generate new login code
                val request = Request.Builder()
                    .url("$serverBaseUrl/api/tvs/$tvId/generate-login-code")
                    .post("".toRequestBody())
                    .build()

                client.newCall(request).execute().use { response ->
                    if (response.isSuccessful) {
                        val json = JSONObject(response.body!!.string())
                        val loginCode = json.getString("code")
                        val whatsappPhoneNumber = json.getString("whatsAppNumber")
                        val whatsappMessage = "$loginCode - Jangan ubah pesan ini"
                        val whatsappUrl = "https://wa.me/$whatsappPhoneNumber?text=${Uri.encode(whatsappMessage)}"

                        // Store current login code
                        currentLoginCode = loginCode

                        val qrCodeBitmap = generateQrCode(whatsappUrl)

                        withContext(Dispatchers.Main) {
                            val memberQrCodeImageView = findViewById<ImageView>(R.id.member_qr_code)
                            memberQrCodeImageView.setImageBitmap(qrCodeBitmap)

                            // Show visual notification of QR refresh
                            showQrRefreshNotification(loginCode)

                            Log.i("MainActivity", "QR code refreshed with new code: $loginCode")
                        }
                    } else {
                        Log.e("MainActivity", "Failed to generate new QR code: ${response.code}")
                    }
                }
            } catch (e: Exception) {
                Log.e("MainActivity", "Error generating new QR code after session", e)
            }
        }
    }

    private fun showQrRefreshNotification(newCode: String) {
        // Create a temporary TextView to show QR refresh notification
        val notificationText = TextView(this).apply {
            text = "🔄 QR Code Refreshed!\nNew Code: $newCode"
            textSize = 16f
            setTextColor(android.graphics.Color.GREEN)
            gravity = android.view.Gravity.CENTER
            alpha = 0f
            setBackgroundColor(android.graphics.Color.parseColor("#AA000000"))
            setPadding(40, 20, 40, 20)
        }

        val layout = findViewById<LinearLayout>(R.id.homescreen_layout)
        layout.addView(notificationText)

        // Animate the notification
        notificationText.animate()
            .alpha(1f)
            .setDuration(500)
            .withEndAction {
                // Keep visible for 3 seconds then fade out
                notificationText.animate()
                    .alpha(0f)
                    .setStartDelay(3000)
                    .setDuration(500)
                    .withEndAction {
                        layout.removeView(notificationText)
                    }
            }
    }

    private suspend fun generateQrCode(text: String): Bitmap = withContext(Dispatchers.Default) {
        val multiFormatWriter = MultiFormatWriter()
        val bitMatrix = multiFormatWriter.encode(text, BarcodeFormat.QR_CODE, 400, 400)
        val barcodeEncoder = BarcodeEncoder()
        barcodeEncoder.createBitmap(bitMatrix)
    }



    /**
     * Register broadcast receiver for TV ID configuration
     */
    private fun registerTvIdReceiver() {
        // Direct TV ID receiver (from ADB broadcast)
        tvIdReceiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context?, intent: Intent?) {
                if (intent?.action == TV_ID_BROADCAST_ACTION) {
                    val receivedTvId = intent.getStringExtra("tv_id")?.toIntOrNull()
                    if (receivedTvId != null) {
                        Log.i("MainActivity", "🆔 Received TV ID via direct broadcast: $receivedTvId")
                        handleTvIdConfiguration(receivedTvId)
                    } else {
                        Log.w("MainActivity", "❌ Invalid TV ID received via direct broadcast")
                    }
                }
            }
        }

        // TV ID configured receiver (from TvIdReceiver)
        tvIdConfiguredReceiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context?, intent: Intent?) {
                if (intent?.action == TV_ID_CONFIGURED_ACTION) {
                    val receivedTvId = intent.getStringExtra("tv_id")?.toIntOrNull()
                    if (receivedTvId != null) {
                        Log.i("MainActivity", "🆔 Received TV ID via configured broadcast: $receivedTvId")
                        handleTvIdConfiguration(receivedTvId)
                    } else {
                        Log.w("MainActivity", "❌ Invalid TV ID received via configured broadcast")
                    }
                }
            }
        }

        val directFilter = IntentFilter(TV_ID_BROADCAST_ACTION)
        val configuredFilter = IntentFilter(TV_ID_CONFIGURED_ACTION)

        registerReceiver(tvIdReceiver, directFilter)
        registerReceiver(tvIdConfiguredReceiver, configuredFilter)

        Log.i("MainActivity", "📡 TV ID broadcast receivers registered")
    }

    /**
     * Handle TV ID configuration from broadcast
     */
    private fun handleTvIdConfiguration(receivedTvId: Int) {
        // Save TV ID to SharedPreferences
        sharedPreferences.edit().putInt("tvId", receivedTvId).apply()
        tvId = receivedTvId

        Log.i("MainActivity", "✅ TV ID configured: $receivedTvId")

        // Update status
        statusTextView.text = "TV ID dikonfigurasi: $receivedTvId. Mencari server..."

        // If we have server URL, check TV status immediately
        if (serverBaseUrl != null) {
            checkTvStatus(receivedTvId)
        }
    }

    /**
     * Update connection status in UI
     */
    private fun updateConnectionStatus(status: String) {
        runOnUiThread {
            // Add version info to status display (UPDATED in v1.2.0)
            val versionInfo = "🚀 v${BuildConfig.VERSION_NAME} - $status"
            statusTextView.text = versionInfo
            Log.i("MainActivity", "📱 UI Status updated: $versionInfo")
        }
    }

    /**
     * Unregister broadcast receivers
     */
    private fun unregisterTvIdReceiver() {
        tvIdReceiver?.let {
            try {
                unregisterReceiver(it)
                Log.i("MainActivity", "📡 Direct TV ID broadcast receiver unregistered")
            } catch (e: Exception) {
                Log.w("MainActivity", "Warning: Failed to unregister direct TV ID receiver", e)
            }
        }
        tvIdReceiver = null

        tvIdConfiguredReceiver?.let {
            try {
                unregisterReceiver(it)
                Log.i("MainActivity", "📡 Configured TV ID broadcast receiver unregistered")
            } catch (e: Exception) {
                Log.w("MainActivity", "Warning: Failed to unregister configured TV ID receiver", e)
            }
        }
        tvIdConfiguredReceiver = null
    }

    override fun onDestroy() {
        super.onDestroy()
        // Cancel all background jobs and disconnect Socket.IO
        pollingJob?.cancel()
        stopHeartbeat()
        disconnectSocketIO()
        // Unregister broadcast receiver
        unregisterTvIdReceiver()
    }

    override fun onPause() {
        super.onPause()
        // Cancel network scan job but keep session polling active
        networkScanJob?.cancel()
    }

    override fun onResume() {
        super.onResume()
        // Restart network scan if server not found
        if (serverBaseUrl == null) {
            startNetworkScan()
        }
        // Reconnect Socket.IO or restart polling if needed
        if (tvId != null && socket?.connected() != true && pollingJob?.isActive != true) {
            connectSocketIO(tvId!!)
        }
    }
}