---
type: "agent_requested"
description: "Example description"
---
---
type: "always_apply"
description: "Example description"---
# ATURAN PENGEMBANGAN APLIKASI RENTAL PS

## ATURAN UMUM
- Selalu gunakan bahasa Indonesia dalam komunikasi dan chat
- Kode program boleh menggunakan bahasa Inggris
- UI/UX harus menggunakan bahasa Indonesia untuk user experience

## LARANGAN EKSEKUSI
- JANGAN jalankan perintah `npm run dev` atau `npm start`
- JANGAN jalankan server development secara otomatis
- Hanya jalankan jika user secara eksplisit meminta

## MAINTENANCE DEV_LOG.TXT
- SELALU update dev_log.txt setelah selesai edit kode
- Format: komponen status, fitur implemented, teknologi, bug fixes, next steps
- Gunakan format ringkas tapi comprehensive untuk AI context
- JANGAN hapus history penting, prioritaskan informasi essential
- Update tanggal pada setiap perubahan signifikan

## PROTOKOL DOKUMENTASI PERUBAHAN
- Catat setiap bug fix yang signifikan dengan solusi singkat
- Dokumentasikan fitur baru dengan status implementasi
- Update progress percentage untuk setiap komponen
- Sertakan teknologi dan keputusan arsitektur penting

## TRACKING FITUR & BUG FIXES
- Prioritaskan bug fixes yang mempengaruhi core functionality
- Catat enhancement UX/UI yang meningkatkan user experience
- Dokumentasikan integrasi antar komponen (Backend-Frontend-WhatsApp-Android)
- Track real-time features dan Socket.IO implementations

## GUIDELINES KHUSUS RENTAL PS
- Pahami konteks dengan membaca design.txt dan dev_log.txt sebelum coding
- Fokus pada user experience yang smooth untuk booking sesi gaming
- Prioritaskan real-time features untuk monitoring TV dan sesi
- Maintain consistency dalam WhatsApp bot responses
- Ensure Android TV helper app terintegrasi dengan backend

## FORMAT UPDATE DEV_LOG
```
## STATUS KOMPONEN (Update: YYYY-MM-DD)
[Progress percentage dan status singkat]

## FITUR UTAMA YANG SUDAH IMPLEMENTED
[Bullet points dengan status]

## BUG FIXES PENTING
[Hanya yang signifikan]

## CURRENT STATE & NEXT STEPS
[Status dan prioritas]
```

## VALIDASI SEBELUM COMMIT
- Verify semua fitur penting terdokumentasi
- Check consistency format dan bahasa Indonesia

## DEV_LOG MANAGEMENT
### ATURAN PANJANG FILE
- **MAKSIMAL 80 BARIS KONTEN** + 20 baris untuk formatting/spacingu
- **PRIORITAS INFORMASI**: Current status > Major features > Critical fixes > Next steps

### STRUKTUR WAJIB
```
# APLIKASI RENTAL PS - DEV LOG

## STATUS KOMPONEN (Update: YYYY-MM-DD)
[Progress percentage dan status singkat - MAX 5 baris]

## FITUR UTAMA IMPLEMENTED
[Bullet points dengan status - MAX 25 baris]

## RECENT CRITICAL FIXES (YYYY-MM-DD)
[Hanya yang signifikan - MAX 15 baris]

## CURRENT STATE & NEXT STEPS
[Status dan prioritas - MAX 20 baris]

## ARCHITECTURE NOTES
[Essential technical info - MAX 10 baris]

**RECENT UPDATES (YYYY-MM-DD):**
[Bullet points singkat - MAX 10 baris]
```

### INFORMASI YANG HARUS DIPERTAHANKAN
- **Component status percentages** dengan emoji indicators
- **Major implemented features** dengan technology stack
- **Critical bug fixes** yang mempengaruhi core functionality
- **Current production readiness status**
- **Immediate next steps** dan priorities
- **Known issues** yang belum resolved
- **Architecture decisions** yang penting untuk AI context

### INFORMASI YANG BOLEH DIHAPUS
- **Detailed technical explanations** (simpan di kode comments)
- **Step-by-step implementation details** (ada di git history)
- **Verbose descriptions** dan redundant explanations
- **Historical context** yang tidak relevan untuk current work
- **Testing details** yang sudah completed
- **Business impact explanations** yang berlebihan

### ATURAN UPDATE
- **SETIAP MAJOR CHANGE**: Update status percentages
- **SETIAP BUG FIX**: Add to recent fixes (max 3 entries)
- **SETIAP NEW FEATURE**: Add to implemented features
- **SETIAP MINGGU**: Review dan compress jika perlu
- **SEBELUM HANDOVER**: Ensure semua critical info tersimpan

### FORMAT SINGKAT YANG DIGUNAKAN
- **Bullet points** instead of paragraphs
- **Emoji indicators** untuk status (✅🔄❌🚨)
- **Abbreviations**: "impl" untuk implemented, "config" untuk configuration
- **Technology mentions** tanpa detailed explanations
- **Status keywords**: FIXED, NEW, COMPLETED, ONGOING, PENDING

### CONTOH COMPRESSION
```
Before (verbose):
"Implementasi lengkap sistem member management dengan enhanced search functionality yang menggunakan debounced input untuk mengurangi API calls, responsive design yang optimal untuk mobile devices, dan comprehensive error handling dengan user-friendly messages."

After (compressed):
"Member management: Enhanced search/filter, responsive design, error handling (COMPLETED)"
```

### VALIDATION CHECKLIST
- [ ] Semua component status ada
- [ ] Recent fixes ≤ 3 entries
- [ ] Next steps jelas dan actionable
- [ ] Architecture notes essential only
- [ ] Tanggal update terbaru
- [ ] Bahasa Indonesia untuk komunikasi
- [ ] Format consistent dengan template

## ANDROID TV DEVELOPMENT
### KOTLIN COROUTINES BEST PRACTICES
- **Background Tasks**: Gunakan `lifecycleScope.launch(Dispatchers.IO)` untuk network operations
- **UI Updates**: Selalu gunakan `withContext(Dispatchers.Main)` untuk update UI dari background thread
- **Job Management**: Store coroutine jobs dalam variables untuk proper cancellation
- **Error Handling**: Wrap coroutines dalam try-catch blocks dengan specific error types
- **Delay Operations**: Gunakan `delay()` instead of `Thread.sleep()` dalam coroutines

### LIFECYCLE MANAGEMENT
- **onDestroy()**: Cancel semua background jobs (pollingJob, qrRefreshJob, countdownJob)
- **onPause()**: Cancel resource-intensive jobs untuk save battery
- **onResume()**: Restart necessary background tasks jika masih diperlukan
- **Memory Leaks**: Selalu cancel jobs dan clear references di lifecycle callbacks
- **State Preservation**: Save critical state dalam SharedPreferences atau ViewModel

### UI THREAD SAFETY
- **Main Thread Rule**: Semua UI updates harus di main thread
- **Background to UI**: Gunakan `withContext(Dispatchers.Main)` atau `runOnUiThread`
- **View References**: Avoid storing view references dalam background tasks
- **findViewById**: Call findViewById di main thread, bukan di background coroutines
- **Animation Safety**: Ensure animations run on main thread dengan proper lifecycle checks

### ERROR HANDLING PATTERNS
- **Network Errors**: Implement retry logic dengan exponential backoff
- **User Feedback**: Show clear error messages dengan actionable solutions
- **Graceful Degradation**: Provide fallback mechanisms (manual refresh button)
- **Logging**: Use structured logging dengan appropriate log levels (DEBUG, ERROR)
- **Exception Types**: Handle specific exceptions (IOException, JSONException, etc.)

### TESTING PROCEDURES
- **Unit Tests**: Test business logic dan utility functions
- **Integration Tests**: Test API communication dan data parsing
- **UI Tests**: Test user interactions dan lifecycle scenarios
- **Memory Tests**: Check for memory leaks dengan profiler
- **Network Tests**: Test dengan poor connectivity dan timeouts
- **Build Verification**: Ensure `./gradlew build` passes without errors
- **APK Testing**: Install dan test APK pada actual Android TV device

### CODE QUALITY STANDARDS
- **Null Safety**: Gunakan Kotlin null safety features (`?.`, `!!`, `let`)
- **Resource Management**: Proper cleanup untuk network connections dan timers
- **Performance**: Avoid blocking main thread dengan heavy operations
- **Security**: Validate input dan sanitize network responses
- **Documentation**: Comment complex logic dan document public APIs
