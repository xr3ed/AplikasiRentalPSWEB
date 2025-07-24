const { Client, LocalAuth } = require('whatsapp-web.js');
let io;
const qrcode = require('qrcode-terminal');
const { getMemberByPhone, createMemberInternal } = require('./services/memberService');
const userContext = {};
const tvService = require('./services/tvService');
const packageService = require('./services/packageService');

// Function to format phone number properly
const formatPhoneNumber = (whatsappPhone) => {
    // Remove @c.us suffix if present
    let cleanPhone = whatsappPhone;
    if (cleanPhone.includes('@c.us')) {
        cleanPhone = cleanPhone.replace('@c.us', '');
    }

    // Add + prefix if not present
    if (!cleanPhone.startsWith('+')) {
        cleanPhone = '+' + cleanPhone;
    }

    return cleanPhone;
};

const client = new Client({
    authStrategy: new LocalAuth()
});

client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('WhatsApp client is ready!');

    // Setup WhatsApp client untuk notification service
    const whatsappNotificationService = require('./services/whatsappNotificationService');
    whatsappNotificationService.setWhatsAppClient(client);
    console.log('📱 WhatsApp notification service initialized');
});

client.on('message', async message => {
    const sender = message.from; // Nomor pengirim
    const body = message.body.trim();
    const lowerBody = body.toLowerCase();

    try {
        // Regex for 8-digit hex login code
        const potentialCode = body.split(' ')[0];
        const loginCodeRegex = /^[A-F0-9]{8}$/i;

        if (loginCodeRegex.test(potentialCode)) {
            const loginCode = potentialCode;
            try {
                const tv = await tvService.getTvByLoginCode(loginCode);
                if (!tv) {
                    return message.reply(
`🚫 *KODE LOGIN TIDAK VALID*

┌─────────────────────────┐
│  🔍 *DIAGNOSIS MASALAH*  │
└─────────────────────────┘

🕐 *Kemungkinan penyebab:*
• ⏰ Kode sudah kedaluwarsa (5 menit)
• ❌ Kode salah diketik atau tidak lengkap
• 🎮 TV sedang digunakan orang lain
• 🔄 Kode sudah pernah digunakan

┌─────────────────────────┐
│  🛠️ *CARA MENGATASI*    │
└─────────────────────────┘

1️⃣ *Scan ulang QR code* di layar TV
2️⃣ *Ketik kode dengan benar* (8 karakter)
3️⃣ *Tunggu* jika TV sedang digunakan
4️⃣ *Hubungi operator* jika masalah berlanjut

📋 *Format kode yang benar:*
• 8 karakter huruf A-F dan angka 0-9
• Contoh: *A1B2C3D4* atau *FF00AA99*

💡 *Tips:* Kode login hanya berlaku 5 menit dan hanya bisa digunakan sekali!

🎮 *PS Rental System* - Gaming Experience`
                    );
                }

                // STEP 1: Check if TV is locked by another user
                const tvLock = await tvService.getTvLock(tv.id);
                if (tvLock && tvLock.user_phone !== sender) {
                    return message.reply(
`🔒 *TV SEDANG DIGUNAKAN*

┌─────────────────────────┐
│  ⏰ *TV TEMPORARILY LOCKED* │
└─────────────────────────┘

📺 TV ini sedang dalam proses login oleh user lain
⏱️ Estimasi tersedia: 2 menit lagi

┌─────────────────────────┐
│  🎯 *SOLUSI*             │
└─────────────────────────┘

1️⃣ *Tunggu beberapa menit* dan scan ulang
2️⃣ *Pilih TV lain* yang tersedia
3️⃣ *Ketik CEK TV* untuk lihat status semua TV

🎮 *PS Rental System* - Please Wait`
                    );
                }

                // STEP 2: Check user eligibility
                const eligibility = await tvService.checkUserEligibility(sender);

                if (!eligibility.eligible) {
                    // User not eligible - TV TIDAK di-lock, kirim error message
                    if (eligibility.reason === 'not_registered') {
                        return message.reply(
`🎮 *SELAMAT DATANG DI PS RENTAL!*

┌─────────────────────────┐
│  🎉 *HAMPIR BERHASIL!*   │
└─────────────────────────┘

👋 Halo! Terima kasih sudah scan QR code kami!

🎯 *Kabar baik:* TV tersedia dan siap untuk Anda!
📱 *Langkah terakhir:* Daftar dulu sebagai member

┌─────────────────────────┐
│  🚀 *DAFTAR SUPER MUDAH* │
└─────────────────────────┘

Cukup ketik: *DAFTAR [Nama Lengkap Anda]*

💡 *Contoh:*
• DAFTAR Budi Santoso
• DAFTAR Maria Sari
• DAFTAR Ahmad Rizki

┌─────────────────────────┐
│  🎁 *KEUNTUNGAN MEMBER*  │
└─────────────────────────┘

✅ Main di semua TV gaming premium
✅ Paket hemat dengan harga terbaik
✅ Riwayat bermain tersimpan otomatis
✅ Notifikasi WhatsApp real-time
✅ Support prioritas 24/7

🎮 *Daftar sekarang dan langsung main!*

💬 *PS Rental System* - Your Gaming Adventure Awaits!`
                        );
                    } else if (eligibility.reason === 'no_packages') {
                        return message.reply(
`🎮 *HALO MEMBER PS RENTAL!*

┌─────────────────────────┐
│  ⚡ *SIAP MAIN LAGI?*     │
└─────────────────────────┘

👋 Selamat datang kembali!
📺 TV yang Anda pilih sudah siap untuk gaming

💰 *Status saldo:* Paket gaming habis
🎯 *Solusi:* Isi ulang paket untuk main lagi!

┌─────────────────────────┐
│  🛒 *BELI PAKET MUDAH*   │
└─────────────────────────┘

1️⃣ *Hubungi operator* untuk pilih paket
2️⃣ *Transfer* sesuai harga paket
3️⃣ *Konfirmasi* ke operator
4️⃣ *Langsung main* setelah saldo masuk!

💵 *Ketik HARGA* untuk lihat daftar paket
📞 *Hubungi operator* untuk pembelian cepat

🎮 *PS Rental System* - Level Up Your Gaming!`
                        );
                    }
                    return; // Exit early for non-eligible users
                }

                // STEP 3: User eligible - Lock TV
                await tvService.lockTvForUser(tv.id, sender, 120); // Lock 2 menit

                // Get member and packages from eligibility check
                const member = eligibility.member;
                const memberPackages = eligibility.packages;

                // memberPackages already available from eligibility check above

                if (!memberPackages || memberPackages.length === 0) {
                    // Get available packages from database
                    const availablePackages = await packageService.getAllPackages();
                    const packageList = availablePackages.map(p => `• ${p.name} - Rp ${p.price.toLocaleString('id-ID')}`).join('\n');
                    
                    return message.reply(
`� *SALDO PAKET HABIS*

┌─────────────────────────┐
│  👋 Halo, ${member.name}!     │
└─────────────────────────┘

🚨 *Status akun:* Tidak ada paket gaming tersedia

┌─────────────────────────┐
│  💰 *PAKET TERSEDIA*     │
└─────────────────────────┘

${packageList}

┌─────────────────────────┐
│  🛒 *CARA TOP-UP SALDO*  │
└─────────────────────────┘

1️⃣ *Hubungi operator* untuk pembelian paket
2️⃣ *Transfer* sesuai nominal paket
3️⃣ *Konfirmasi* pembayaran ke operator
4️⃣ *Saldo otomatis* masuk ke akun Anda

📞 *Kontak operator:*
• WhatsApp: [Nomor Operator]
• Telegram: [Username Operator]

💡 *Tips hemat:* Beli paket besar untuk harga lebih murah per menit!

🎮 *PS Rental System* - Level Up Your Gaming`
                    );
                }

                // Store context for package selection (FIXED: Added loginCode to context)
                userContext[sender] = {
                    stage: 'selecting_package',
                    tvId: tv.id,
                    tvName: tv.name,
                    loginCode: loginCode, // Store login code for later use
                    memberId: member.id,
                    memberPackages,
                    loginCode: loginCode // Store login code for marking as used later
                };

                const packageList = memberPackages.map((p, index) => `${index + 1}. ${p.package_name} (${p.remaining_minutes} menit)`).join('\n');

                await message.reply(
`🎮 *SELAMAT DATANG DI PS RENTAL*

┌─────────────────────────┐
│  🎯 *LOGIN BERHASIL!*    │
└─────────────────────────┘

👋 Halo *${member.name}*, selamat datang kembali!
📺 TV yang dipilih: *${tv.name}*

┌─────────────────────────┐
│  🎁 *PAKET GAMING ANDA*  │
└─────────────────────────┘

${packageList}

┌─────────────────────────┐
│  🕹️ *CARA BERMAIN*       │
└─────────────────────────┘

1️⃣ *Pilih paket* dengan membalas nomor (1, 2, 3, dst)
2️⃣ *Sesi dimulai* otomatis setelah konfirmasi
3️⃣ *Helper app* akan pindah ke background
4️⃣ *Nikmati gaming* tanpa gangguan!

💡 *Tips:* Pilih paket sesuai durasi bermain Anda untuk pengalaman optimal!

⏰ *Waktu login terbatas* - Segera pilih paket Anda!

🎮 *PS Rental System* - Where Gaming Dreams Come True`
                );

            } catch (error) {
                console.error('Error processing login code:', error);
                message.reply(
`🚨 *GAGAL MEMPROSES KODE LOGIN*

┌─────────────────────────┐
│  ⚠️ *SISTEM BERMASALAH*  │
└─────────────────────────┘

💥 Terjadi kesalahan saat memproses kode login Anda
🔧 Tim teknis sedang menangani masalah ini

┌─────────────────────────┐
│  🛠️ *SOLUSI SEMENTARA*   │
└─────────────────────────┘

1️⃣ *Tunggu 1-2 menit* - Coba masukkan kode lagi
2️⃣ *Scan QR baru* - Dapatkan kode login fresh
3️⃣ *Restart WhatsApp* - Tutup dan buka kembali
4️⃣ *Hubungi support* - Jika masalah berlanjut

📞 *Emergency support:*
• WhatsApp operator: [Nomor]
• Report error: Screenshot pesan ini

🎮 *PS Rental System* - Technical Support`
                );
            }
        } else if (userContext[sender] && userContext[sender].stage === 'selecting_package') {
            const choice = parseInt(body, 10);
            const { memberPackages, tvId, tvName } = userContext[sender];

            if (isNaN(choice) || choice < 1 || choice > memberPackages.length) {
                return message.reply(
`🚫 *PILIHAN TIDAK VALID*

┌─────────────────────────┐
│  ⚠️ *INPUT SALAH*        │
└─────────────────────────┘

🎯 *Yang Anda masukkan:* "${body}"
❌ *Status:* Tidak dapat diproses

┌─────────────────────────┐
│  📋 *CARA YANG BENAR*    │
└─────────────────────────┘

✅ Balas dengan *nomor paket* yang tersedia
📊 Pilihan valid: *1* sampai *${memberPackages.length}*

💡 *Contoh yang benar:*
• Ketik: *1* (untuk paket pertama)
• Ketik: *2* (untuk paket kedua)
• Ketik: *3* (untuk paket ketiga)

⏰ *Jangan terlalu lama* memilih, kode login akan kedaluwarsa!

🎮 *PS Rental System* - Choose Your Gaming Adventure`
                );
            }

            const selectedPackage = memberPackages[choice - 1];

            try {
                await tvService.startPackageSession(tvId, selectedPackage.id, member.id, io);

                // CRITICAL FIX: Mark login code as used after successful session start
                const loginCode = userContext[sender].loginCode;
                if (loginCode) {
                    await tvService.markLoginCodeAsUsed(loginCode);
                    console.log(`🔒 Login code ${loginCode} marked as used after session start`);
                }

                // STEP 4: Unlock TV and trigger QR refresh
                await tvService.unlockTv(tvId);

                // Generate new login code and trigger QR refresh
                const newCode = await tvService.generateLoginCode(tvId);
                io.emit(`tv_status_${tvId}`, {
                    type: 'qr_refresh',
                    new_code: newCode,
                    reason: 'session_started',
                    timestamp: new Date().toISOString()
                });

                console.log(`🔄 QR refreshed for TV ${tvId} after session start (new code: ${newCode})`);

                // Clear user context
                delete userContext[sender];

                message.reply(
`🚀 *SESI GAMING DIMULAI!*

┌─────────────────────────┐
│  🎉 *SELAMAT BERMAIN!*   │
└─────────────────────────┘

🎮 *Detail sesi Anda:*
• 📺 TV: *${tvName}*
• 📦 Paket: *${selectedPackage.package_name}*
• ⏱️ Durasi: *${selectedPackage.remaining_minutes} menit*
• 👤 Player: *${member.name}*

┌─────────────────────────┐
│  � *STATUS AKTIF*       │
└─────────────────────────┘

✅ Helper app telah pindah ke background
✅ TV siap untuk gaming
✅ Timer otomatis berjalan
✅ Notifikasi WhatsApp aktif

┌─────────────────────────┐
│  🎮 *KONTROL SESI*       │
└─────────────────────────┘

🛑 Ketik *STOP* untuk menghentikan sesi
📊 Ketik *CEK TV* untuk cek status
⏰ Sesi akan berakhir otomatis sesuai durasi

💡 *Tips gaming:* Nikmati permainan tanpa gangguan! Helper app akan muncul kembali saat sesi berakhir.

🎮 *PS Rental System* - Game On!`
                );
            } catch (error) {
                message.reply(
`🚨 *GAGAL MEMULAI SESI GAMING*

┌─────────────────────────┐
│  ⚠️ *TERJADI KESALAHAN*  │
└─────────────────────────┘

🔍 *Detail error:*
${error.message}

┌─────────────────────────┐
│  🛠️ *SOLUSI CEPAT*       │
└─────────────────────────┘

1️⃣ *Cek status TV* - Pastikan TV masih tersedia
2️⃣ *Tunggu sebentar* - Coba lagi dalam 30 detik
3️⃣ *Scan ulang QR* - Dapatkan kode login baru
4️⃣ *Restart helper app* - Tutup dan buka kembali

┌─────────────────────────┐
│  📞 *BUTUH BANTUAN?*     │
└─────────────────────────┘

💬 Hubungi operator jika masalah berlanjut
📱 Kirim screenshot error ini untuk bantuan lebih cepat
🔄 Ketik *HELP* untuk panduan lengkap

⚡ *Jangan khawatir!* Tim support kami siap membantu 24/7

🎮 *PS Rental System* - We're Here to Help`
                );
            }
            
            // Hapus konteks setelah selesai
            delete userContext[sender];

        } else if (lowerBody === 'daftar') {
            // Handle "daftar" without name - show friendly instruction
            message.reply(
`🎮 *HAMPIR BERHASIL DAFTAR!*

┌─────────────────────────┐
│  😊 *TINGGAL SATU LANGKAH* │
└─────────────────────────┘

👋 Halo! Terima kasih sudah mau bergabung dengan PS Rental!

🎯 *Yang Anda ketik:* "${body}"
📝 *Yang kurang:* Nama lengkap Anda

┌─────────────────────────┐
│  ✨ *CARA YANG BENAR*     │
└─────────────────────────┘

Ketik: *DAFTAR [Nama Lengkap Anda]*

🌟 *Contoh yang benar:*
• DAFTAR Budi Santoso
• DAFTAR Maria Sari Dewi
• DAFTAR Ahmad Rizki Pratama

┌─────────────────────────┐
│  🎁 *SETELAH DAFTAR*     │
└─────────────────────────┘

✅ Langsung bisa main di semua TV
✅ Dapat paket hemat eksklusif
✅ Notifikasi WhatsApp otomatis
✅ Support prioritas 24/7

💡 *Tips:* Gunakan nama asli Anda untuk kemudahan verifikasi

🎮 *PS Rental System* - Almost There, Champion!`
            );
        } else if (lowerBody.startsWith('daftar ')) {
            // Check if member already exists for DAFTAR command
            const member = await getMemberByPhone(sender);
            if (member) {
                return message.reply(
`🎉 *HALO ${member.name.toUpperCase()}!*

┌─────────────────────────┐
│  ⭐ *MEMBER VIP AKTIF*    │
└─────────────────────────┘

🎮 Anda sudah terdaftar sebagai member PS Rental!
✨ Akun Anda siap untuk gaming experience terbaik

┌─────────────────────────┐
│  🚀 *YUK MAIN SEKARANG*  │
└─────────────────────────┘

🎯 *3 langkah mudah:*
1️⃣ *Scan QR code* di TV yang tersedia
2️⃣ *Ketik kode 8 digit* yang muncul
3️⃣ *Pilih paket* dan langsung main!

┌─────────────────────────┐
│  💡 *COMMAND BERGUNA*    │
└─────────────────────────┘

📺 *CEK TV* - Lihat TV yang tersedia
💰 *SALDO* - Cek paket gaming Anda
💵 *HARGA* - Daftar harga semua paket
❓ *HELP* - Panduan lengkap

🎮 *PS Rental System* - Game On, Champion!`
                );
            }
            const name = body.substring(7).trim();
            if (name) {
                // Format phone number properly (remove @c.us, add +)
                const formattedPhone = formatPhoneNumber(sender);

                await createMemberInternal({ name, phone: formattedPhone });
                message.reply(
`🎉 *SELAMAT! PENDAFTARAN BERHASIL*

┌─────────────────────────┐
│  🎊 *WELCOME TO THE CLUB* │
└─────────────────────────┘

👤 *Data member baru:*
• 📝 Nama: *${name}*
• 📱 WhatsApp: *${formattedPhone}*
• 🆔 Status: *Member Aktif*
• 📅 Bergabung: *${new Date().toLocaleDateString('id-ID')}*

┌─────────────────────────┐
│  🚀 *LANGKAH SELANJUTNYA* │
└─────────────────────────┘

1️⃣ *Beli paket gaming* - Hubungi operator
2️⃣ *Pilih TV favorit* - Scan QR code di layar
3️⃣ *Masukkan kode login* - 8 digit dari TV
4️⃣ *Mulai bermain* - Nikmati gaming experience!

┌─────────────────────────┐
│  � *KEUNTUNGAN MEMBER*   │
└─────────────────────────┘

✅ Akses ke semua TV gaming premium
✅ Sistem paket hemat dengan diskon
✅ Riwayat bermain tersimpan otomatis
✅ Notifikasi WhatsApp real-time
✅ Support prioritas 24/7
✅ Event dan promo eksklusif member

💡 *Tips:* Ketik *HELP* kapan saja untuk panduan lengkap!

🎮 *PS Rental System* - Your Gaming Journey Starts Here!`
                );
            } else {
                // Handle "DAFTAR " with empty/invalid name
                message.reply(
`🎮 *NAMA DIPERLUKAN UNTUK DAFTAR!*

┌─────────────────────────┐
│  � *NAMA TIDAK LENGKAP* │
└─────────────────────────┘

👋 Halo! Saya lihat Anda sudah ketik "DAFTAR" tapi nama belum ada.

🎯 *Yang Anda ketik:* "${body}"
📝 *Yang kurang:* Nama lengkap setelah kata DAFTAR

┌─────────────────────────┐
│  ✨ *FORMAT YANG BENAR*  │
└─────────────────────────┘

Ketik: *DAFTAR [Nama Lengkap Anda]*

🌟 *Contoh:*
• DAFTAR Budi Santoso
• DAFTAR Maria Sari Dewi

💡 *Tips:* Pastikan ada spasi setelah DAFTAR, lalu tulis nama lengkap Anda

🎮 *PS Rental System* - Let's Complete Your Registration!`
                );
            }
        } else if (lowerBody === 'stop') {
            // Check member for STOP command
            const member = await getMemberByPhone(sender);
            if (!member) {
                return message.reply(
`🔐 *AKSES DITOLAK - BELUM TERDAFTAR*

┌─────────────────────────┐
│  ⚠️ *UNAUTHORIZED*       │
└─────────────────────────┘

🚫 Nomor WhatsApp Anda belum terdaftar dalam sistem PS Rental
❌ Tidak dapat menghentikan sesi tanpa registrasi

┌─────────────────────────┐
│  📝 *CARA MENDAFTAR*     │
└─────────────────────────┘

🚀 *Template:* DAFTAR [Nama Lengkap]

💡 *Contoh pendaftaran:*
• DAFTAR John Doe
• DAFTAR Budi Santoso
• DAFTAR Maria Sari

┌─────────────────────────┐
│  🎁 *KEUNTUNGAN MEMBER*  │
└─────────────────────────┘

✅ Kontrol penuh atas sesi gaming
✅ Akses ke semua TV premium
✅ Sistem paket hemat
✅ Riwayat bermain tersimpan
✅ Support prioritas 24/7

🎮 *PS Rental System* - Join Our Gaming Community!`
                );
            }

            const activeTv = await tvService.getActiveTvByMemberId(member.id);

            if (!activeTv) {
                return message.reply(
`💤 *TIDAK ADA SESI AKTIF*

┌─────────────────────────┐
│  ℹ️ *STATUS IDLE*        │
└─────────────────────────┘

👋 Halo *${member.name}*!
🎮 Anda tidak memiliki sesi gaming yang sedang berjalan

┌─────────────────────────┐
│  🚀 *MULAI BERMAIN?*     │
└─────────────────────────┘

🎯 *Langkah mudah untuk gaming:*
1️⃣ *Pilih TV* - Scan QR code di layar TV
2️⃣ *Login* - Masukkan kode 8 digit dari TV
3️⃣ *Pilih paket* - Sesuai durasi bermain
4️⃣ *Enjoy gaming* - Have unlimited fun!

┌─────────────────────────┐
│  💡 *TIPS CEPAT*         │
└─────────────────────────┘

💰 Ketik *SALDO* untuk cek paket Anda
📺 Ketik *CEK TV* untuk lihat TV tersedia
💵 Ketik *HARGA* untuk lihat daftar paket
❓ Ketik *HELP* untuk panduan lengkap

🎮 *PS Rental System* - Ready When You Are!`
                );
            }

            try {
                // Calculate session duration before stopping
                const sessionStartTime = new Date(activeTv.session_start_time);
                const now = new Date();
                const usedDurationMs = now.getTime() - sessionStartTime.getTime();
                const usedDurationMinutes = Math.round(usedDurationMs / 60000);
                
                await tvService.stopSession(activeTv.id, io);
                
                // Format duration display
                let durationText;
                if (usedDurationMinutes < 1) {
                    durationText = "kurang dari 1 menit";
                } else if (usedDurationMinutes === 1) {
                    durationText = "1 menit";
                } else {
                    durationText = `${usedDurationMinutes} menit`;
                }
                
                message.reply(
`🏁 *SESI GAMING BERAKHIR*

┌─────────────────────────┐
│  🎯 *SESI SELESAI!*      │
└─────────────────────────┘

📊 *Ringkasan sesi Anda:*
• 📺 TV: *${activeTv.name}*
• 👤 Player: *${member.name}*
• ⏱️ Waktu bermain: *${durationText}*
• 📅 Tanggal: *${new Date().toLocaleDateString('id-ID')}*

┌─────────────────────────┐
│  🎉 *TERIMA KASIH!*      │
└─────────────────────────┘

🎮 Terima kasih sudah bermain di PS Rental!
⭐ Semoga pengalaman gaming Anda menyenangkan!

┌─────────────────────────┐
│  🔄 *MAIN LAGI?*         │
└─────────────────────────┘

🎯 *Cara bermain lagi:*
1️⃣ *Scan QR code* di TV yang tersedia
2️⃣ *Masukkan kode login* 8 digit
3️⃣ *Pilih paket* sesuai keinginan
4️⃣ *Enjoy gaming* lagi!

💡 *Tips:* Helper app sudah kembali ke layar utama dengan QR code baru!

🎮 *PS Rental System* - Thanks for Playing!`
                );
            } catch (error) {
                message.reply(
`🚨 *GAGAL MENGHENTIKAN SESI*

┌─────────────────────────┐
│  ⚠️ *TERJADI KESALAHAN*  │
└─────────────────────────┘

🔍 *Detail error:*
${error.message}

┌─────────────────────────┐
│  🛠️ *SOLUSI DARURAT*     │
└─────────────────────────┘

1️⃣ *Tunggu 30 detik* - Coba lagi perintah STOP
2️⃣ *Restart helper app* - Tutup dan buka kembali
3️⃣ *Hubungi operator* - Untuk bantuan manual
4️⃣ *Screenshot error* - Kirim ke support

⚠️ *Penting:* Jika sesi tidak berhenti, timer akan tetap berjalan!

📞 *Kontak darurat:*
• WhatsApp operator: [Nomor]
• Telegram support: [Username]

🎮 *PS Rental System* - Emergency Support`
                );
            }
        } else if (lowerBody === 'cek tv' || lowerBody === 'cek status') {
            // RESTORED FEATURE: CEK TV command
            const member = await getMemberByPhone(sender);
            if (!member) {
                return message.reply(
`🔐 *AKSES DITOLAK - BELUM TERDAFTAR*

┌─────────────────────────┐
│  ⚠️ *UNAUTHORIZED*       │
└─────────────────────────┘

🚫 Nomor WhatsApp Anda belum terdaftar dalam sistem PS Rental
❌ Tidak dapat mengecek status TV tanpa registrasi

┌─────────────────────────┐
│  📝 *CARA MENDAFTAR*     │
└─────────────────────────┘

🚀 *Template:* DAFTAR [Nama Lengkap]

💡 *Contoh pendaftaran:*
• DAFTAR John Doe
• DAFTAR Budi Santoso
• DAFTAR Maria Sari

┌─────────────────────────┐
│  🎁 *KEUNTUNGAN MEMBER*  │
└─────────────────────────┘

✅ Cek status TV real-time
✅ Monitor sesi gaming
✅ Akses ke semua fitur
✅ Support prioritas 24/7

🎮 *PS Rental System* - Join Our Gaming Community!`
                );
            }

            try {
                const activeTv = await tvService.getActiveTvByMemberId(member.id);
                const allTvs = await tvService.getAllTvs();
                const availableTvs = allTvs.filter(tv => tv.status === 'inactive').length;
                const totalTvs = allTvs.length;

                if (activeTv) {
                    const sessionStartTime = new Date(activeTv.session_start_time);
                    const now = new Date();
                    const usedDurationMs = now.getTime() - sessionStartTime.getTime();
                    const usedDurationMinutes = Math.round(usedDurationMs / 60000);

                    message.reply(
`📺 *STATUS TV*

*Player:* ${member.name}
*TV Aktif:* ${activeTv.name}
*Status:* � Sedang bermain
*Waktu bermain:* ${usedDurationMinutes} menit

*Info Sistem:*
• Total TV: ${totalTvs}
• TV tersedia: ${availableTvs}

Ketik *STOP* untuk menghentikan sesi.`
                    );
                } else {
                    message.reply(
`📺 *STATUS TV - IDLE*

┌─────────────────────────┐
│  💤 *NO ACTIVE SESSION*  │
└─────────────────────────┘

👤 *Player:* ${member.name}
🎯 *Status:* 💤 Tidak ada sesi aktif

┌─────────────────────────┐
│  📊 *INFO SISTEM*        │
└─────────────────────────┘

🏢 *Total TV:* ${totalTvs} unit
✅ *TV tersedia:* ${availableTvs} unit
🎮 *TV terpakai:* ${totalTvs - availableTvs} unit

┌─────────────────────────┐
│  🚀 *MULAI BERMAIN?*     │
└─────────────────────────┘

1️⃣ *Scan QR code* di layar TV yang tersedia
2️⃣ *Ketik kode login* 8 digit dari TV
3️⃣ *Pilih paket* sesuai durasi bermain
4️⃣ *Enjoy gaming* unlimited fun!

💡 *Tips:* Ketik *SALDO* untuk cek paket Anda

🎮 *PS Rental System* - Ready to Game!`
                    );
                }
            } catch (error) {
                message.reply(
`🚨 *GAGAL MENGECEK STATUS TV*

┌─────────────────────────┐
│  ⚠️ *SISTEM BERMASALAH*  │
└─────────────────────────┘

💥 Terjadi kesalahan saat mengecek status TV
🔍 *Detail error:* ${error.message}

┌─────────────────────────┐
│  🛠️ *SOLUSI CEPAT*       │
└─────────────────────────┘

1️⃣ *Tunggu 30 detik* - Coba lagi perintah CEK TV
2️⃣ *Restart WhatsApp* - Tutup dan buka kembali
3️⃣ *Cek koneksi* - Pastikan internet stabil
4️⃣ *Hubungi support* - Jika masalah berlanjut

📞 *Support contact:*
• WhatsApp operator: [Nomor]
• Report error: Screenshot pesan ini

🎮 *PS Rental System* - Technical Support`
                );
            }
        } else if (lowerBody === 'saldo' || lowerBody === 'cek saldo') {
            // RESTORED FEATURE: SALDO command
            const member = await getMemberByPhone(sender);
            if (!member) {
                return message.reply(
`🔐 *AKSES DITOLAK - BELUM TERDAFTAR*

┌─────────────────────────┐
│  ⚠️ *UNAUTHORIZED*       │
└─────────────────────────┘

🚫 Nomor WhatsApp Anda belum terdaftar dalam sistem PS Rental
❌ Tidak dapat mengecek saldo tanpa registrasi

┌─────────────────────────┐
│  📝 *CARA MENDAFTAR*     │
└─────────────────────────┘

🚀 *Template:* DAFTAR [Nama Lengkap]

💡 *Contoh pendaftaran:*
• DAFTAR John Doe
• DAFTAR Budi Santoso
• DAFTAR Maria Sari

┌─────────────────────────┐
│  🎁 *KEUNTUNGAN MEMBER*  │
└─────────────────────────┘

✅ Cek saldo paket real-time
✅ Monitor penggunaan gaming
✅ Akses ke semua fitur
✅ Support prioritas 24/7

🎮 *PS Rental System* - Join Our Gaming Community!`
                );
            }

            try {
                const memberPackages = await packageService.getMemberPackages(member.id);

                if (!memberPackages || memberPackages.length === 0) {
                    message.reply(
`� *SALDO PAKET KOSONG*

┌─────────────────────────┐
│  😔 *NO PACKAGES FOUND*  │
└─────────────────────────┘

👤 *Player:* ${member.name}
💰 *Status saldo:* Tidak ada paket gaming tersedia

┌─────────────────────────┐
│  🛒 *CARA TOP-UP SALDO*  │
└─────────────────────────┘

1️⃣ *Hubungi operator* untuk pembelian paket
2️⃣ *Pilih paket* sesuai kebutuhan gaming
3️⃣ *Transfer* sesuai nominal paket
4️⃣ *Konfirmasi* pembayaran ke operator
5️⃣ *Saldo otomatis* masuk ke akun Anda

┌─────────────────────────┐
│  💡 *QUICK ACTIONS*      │
└─────────────────────────┘

💵 Ketik *HARGA* untuk lihat daftar paket
📞 Hubungi operator untuk top-up
🎮 Mulai gaming setelah saldo masuk

🎮 *PS Rental System* - Top-Up Your Gaming`
                    );
                } else {
                    const packageList = memberPackages.map(p =>
                        `• ${p.package_name}: ${p.remaining_minutes} menit`
                    ).join('\n');

                    const totalMinutes = memberPackages.reduce((sum, p) => sum + p.remaining_minutes, 0);

                    message.reply(
`💰 *SALDO PAKET*

*Player:* ${member.name}
*Total waktu:* ${totalMinutes} menit

*Detail paket:*
${packageList}

Scan QR code di TV untuk mulai bermain!`
                    );
                }
            } catch (error) {
                message.reply(
`❌ *Gagal mengecek saldo*

Error: ${error.message}

Coba lagi dalam beberapa saat.`
                );
            }
        } else if (lowerBody === 'harga' || lowerBody === 'paket') {
            // RESTORED FEATURE: HARGA command
            try {
                const availablePackages = await packageService.getAllPackages();

                if (!availablePackages || availablePackages.length === 0) {
                    message.reply(
`💵 *DAFTAR HARGA*

😔 Tidak ada paket tersedia saat ini.

Hubungi operator untuk informasi lebih lanjut.`
                    );
                } else {
                    const packageList = availablePackages.map(p =>
                        `• ${p.name}\n  💰 Rp ${p.price.toLocaleString('id-ID')}\n  ⏱️ ${p.duration} menit`
                    ).join('\n\n');

                    message.reply(
`💵 *DAFTAR HARGA*

${packageList}

*Cara beli:*
Hubungi operator untuk top-up paket.

*Cara main:*
Scan QR code di TV setelah punya paket.`
                    );
                }
            } catch (error) {
                message.reply(
`❌ *Gagal mengambil daftar harga*

Error: ${error.message}

Coba lagi dalam beberapa saat.`
                );
            }
        } else if (lowerBody === 'help' || lowerBody === 'bantuan') {
            // RESTORED FEATURE: HELP command
            message.reply(
`📚 *PANDUAN LENGKAP PS RENTAL*

┌─────────────────────────┐
│  🎮 *WELCOME TO HELP*    │
└─────────────────────────┘

🤖 *Bot Commands Available:*

🔍 *CEK TV* - Cek status TV dan sesi aktif
💰 *SALDO* - Cek saldo paket gaming Anda
💵 *HARGA* - Lihat daftar harga semua paket
🛑 *STOP* - Hentikan sesi gaming yang sedang berjalan
❓ *HELP* - Tampilkan panduan lengkap ini
👤 *DAFTAR [nama]* - Daftar sebagai member baru

┌─────────────────────────┐
│  🎯 *CARA BERMAIN*       │
└─────────────────────────┘

1️⃣ *Registrasi* - Ketik DAFTAR [nama lengkap]
2️⃣ *Beli paket* - Hubungi operator untuk top-up
3️⃣ *Pilih TV* - Scan QR code di layar TV
4️⃣ *Login* - Masukkan kode 8 digit dari TV
5️⃣ *Pilih paket* - Balas dengan nomor paket
6️⃣ *Enjoy gaming* - Helper app otomatis ke background

┌─────────────────────────┐
│  🔐 *FORMAT KODE LOGIN*  │
└─────────────────────────┘

📋 *Spesifikasi:*
• 8 karakter kombinasi huruf A-F dan angka 0-9
• Case insensitive (besar/kecil sama saja)
• Berlaku 5 menit setelah di-generate
• Hanya bisa digunakan sekali

💡 *Contoh kode valid:*
• A1B2C3D4
• FF00AA99
• 12345678
• ABCDEF01

┌─────────────────────────┐
│  📞 *SUPPORT CENTER*     │
└─────────────────────────┘

🆘 *Butuh bantuan?*
• WhatsApp: [Nomor Operator]
• Telegram: [Username Support]
• Email: support@psrental.com

⏰ *Jam operasional:* 24/7
🚀 *Response time:* < 5 menit

🎮 *PS Rental System v3.0*
💫 *Your Ultimate Gaming Experience*`
            );
        } else if (lowerBody === '!ping') {
            message.reply(
`🏓 *PONG! SERVER ONLINE*

┌─────────────────────────┐
│  ⚡ *SYSTEM STATUS*       │
└─────────────────────────┘

✅ *Koneksi:* Aktif dan stabil
⚡ *Server:* Online 24/7
🤖 *Bot:* Siap melayani Anda
🎮 *Gaming:* All systems go!
📡 *Response time:* ${Date.now() % 100}ms

┌─────────────────────────┐
│  🎯 *QUICK START*        │
└─────────────────────────┘

1️⃣ Scan QR code di layar TV
2️⃣ Masukkan kode login 8 digit
3️⃣ Pilih paket gaming favorit
4️⃣ Enjoy unlimited gaming!

🎮 *PS Rental System v3.0*
🚀 *Ready to Game? Let's Go!*`
            );
        } else {
            // Pesan default jika tidak ada perintah yang cocok (FIXED: Proper WhatsApp formatting)
            message.reply(
`� *PERINTAH TIDAK DIKENAL*

┌─────────────────────────┐
│  ❓ *WHAT YOU TYPED*     │
└─────────────────────────┘

📝 *Input Anda:* "${body}"
❌ *Status:* Perintah tidak valid

┌─────────────────────────┐
│  🎮 *CARA BERMAIN*       │
└─────────────────────────┘

1️⃣ *Scan QR code* di layar TV
2️⃣ *Ketik kode login* 8 digit dari TV
3️⃣ *Pilih paket* sesuai keinginan
4️⃣ *Start gaming* dan have fun!

┌─────────────────────────┐
│  🤖 *PERINTAH TERSEDIA*  │
└─────────────────────────┘

🔍 *CEK TV* - Status TV dan sesi aktif
💰 *SALDO* - Cek saldo paket gaming
💵 *HARGA* - Daftar harga semua paket
🛑 *STOP* - Hentikan sesi yang berjalan
❓ *HELP* - Panduan lengkap sistem
👤 *DAFTAR [nama]* - Registrasi member

💡 *Tips:* Ketik *HELP* untuk panduan detail dan lengkap!

🎮 *PS Rental System* - Your Gaming Assistant`
            );
        }
    } catch (error) {
        console.error('Error handling WhatsApp message:', error);
        message.reply(
`🚨 *SERVER ERROR - SISTEM BERMASALAH*

┌─────────────────────────┐
│  ⚠️ *UNEXPECTED ERROR*   │
└─────────────────────────┘

💥 Terjadi kesalahan tidak terduga di server
🔧 Tim teknis telah diberitahu otomatis
⏰ Sistem akan pulih dalam beberapa menit

┌─────────────────────────┐
│  🛠️ *YANG BISA DILAKUKAN* │
└─────────────────────────┘

1️⃣ *Tunggu 2-3 menit* - Coba lagi nanti
2️⃣ *Restart WhatsApp* - Tutup dan buka kembali
3️⃣ *Hubungi operator* - Jika masalah berlanjut
4️⃣ *Cek pengumuman* - Di grup atau channel

📞 *Emergency contact:*
• WhatsApp: [Nomor Operator]
• Telegram: [Support Channel]

🎮 *PS Rental System* - Technical Support`
        );
    }
});

function initializeWhatsAppClient(socketIoInstance) {
    io = socketIoInstance;
    client.initialize().catch(err => console.error('WhatsApp client initialization error:', err));
}

module.exports = { client, initializeWhatsAppClient };