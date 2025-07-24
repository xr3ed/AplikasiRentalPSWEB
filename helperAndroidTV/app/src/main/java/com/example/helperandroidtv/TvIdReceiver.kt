package com.example.helperandroidtv

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/**
 * Broadcast receiver for TV ID configuration from ADB
 * This receiver handles TV ID configuration sent via ADB broadcast command
 */
class TvIdReceiver : BroadcastReceiver() {
    
    override fun onReceive(context: Context?, intent: Intent?) {
        if (intent?.action == "com.example.helperandroidtv.SET_TV_ID") {
            val tvId = intent.getStringExtra("tv_id")
            
            if (tvId != null) {
                Log.i("TvIdReceiver", "🆔 Received TV ID configuration: $tvId")
                
                // Save TV ID to SharedPreferences
                val sharedPreferences = context?.getSharedPreferences("NetworkPrefs", Context.MODE_PRIVATE)
                sharedPreferences?.edit()?.putInt("tvId", tvId.toInt())?.apply()
                
                Log.i("TvIdReceiver", "✅ TV ID saved to SharedPreferences: $tvId")
                
                // Send broadcast to MainActivity if it's running
                val mainActivityIntent = Intent("com.example.helperandroidtv.TV_ID_CONFIGURED")
                mainActivityIntent.putExtra("tv_id", tvId)
                context?.sendBroadcast(mainActivityIntent)
                
                Log.i("TvIdReceiver", "📡 Sent TV_ID_CONFIGURED broadcast to MainActivity")
            } else {
                Log.w("TvIdReceiver", "❌ Received TV ID configuration with null value")
            }
        }
    }
}
