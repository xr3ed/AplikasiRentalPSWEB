package com.example.helperandroidtv

import android.os.Bundle
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity

class ErrorActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_error)

        val errorDetails = intent.getStringExtra("errorDetails")
        val errorTextView = findViewById<TextView>(R.id.error_text_view)
        errorTextView.text = errorDetails
    }
}