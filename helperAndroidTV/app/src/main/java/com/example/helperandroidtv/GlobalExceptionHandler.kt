package com.example.helperandroidtv

import android.app.Activity
import android.content.Intent
import android.os.Process
import kotlin.system.exitProcess

class GlobalExceptionHandler(private val activity: Activity, private val defaultHandler: Thread.UncaughtExceptionHandler) : Thread.UncaughtExceptionHandler {

    override fun uncaughtException(thread: Thread, exception: Throwable) {
        val intent = Intent(activity, ErrorActivity::class.java)
        intent.putExtra("errorDetails", exception.stackTraceToString())
        activity.startActivity(intent)
        Process.killProcess(Process.myPid())
        exitProcess(-1)
    }
}