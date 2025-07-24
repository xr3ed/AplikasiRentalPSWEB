const memberService = require('./memberService');

// Import WhatsApp client dari whatsapp.js
let whatsappClient = null;

// Fungsi untuk set WhatsApp client
const setWhatsAppClient = (client) => {
    whatsappClient = client;
};

// Template pesan untuk notifikasi paket aktif
const createPackageActivatedMessage = (memberName, packageData) => {
    const { packageName, duration, price, purchaseDate, quantity = 1 } = packageData;

    const quantityText = quantity > 1 ? ` (${quantity}x)` : '';
    const totalDuration = duration * quantity;
    const totalHours = Math.floor(totalDuration / 60);
    const totalMinutes = totalDuration % 60;
    let totalDurationText = '';
    if (totalHours > 0) {
        totalDurationText = totalMinutes > 0 ? `${totalHours} jam ${totalMinutes} menit` : `${totalHours} jam`;
    } else {
        totalDurationText = `${totalMinutes} menit`;
    }

    // Generate transaction ID (simple format: YYYYMMDD + random 3 digits)
    const transactionId = new Date(purchaseDate).toISOString().slice(0,10).replace(/-/g,'') + Math.floor(Math.random() * 900 + 100);
    const transactionDate = new Date(purchaseDate).toLocaleString('id-ID', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    // Helper function untuk center text dalam lebar tertentu
    const centerText = (text, width = 32) => {
        const padding = Math.max(0, Math.floor((width - text.length) / 2));
        return ' '.repeat(padding) + text + ' '.repeat(width - text.length - padding);
    };



    return `✅ *PAKET BERHASIL DIAKTIFKAN*

================================
${centerText('PS RENTAL GAMING')}
================================
${centerText('Jl. Gaming Center No. 123')}
${centerText('Telp: 0812-3456-7890')}
${centerText('Jam: 09.00 - 22.00 WIB')}

Tanggal: ${transactionDate}
Trx ID : ${transactionId}
Customer: ${memberName}
--------------------------------
Item.....: ${packageName}${quantityText}
Durasi...: ${totalDurationText}
Harga....: Rp ${(price * quantity).toLocaleString('id-ID')}
--------------------------------
${centerText(`TOTAL: Rp ${(price * quantity).toLocaleString('id-ID')}`)}
================================

*CARA MULAI BERMAIN:*
1. Pergi ke TV yang tersedia
2. Scan QR code yang muncul di layar TV
3. Masukkan kode login 8 digit via WhatsApp
4. Pilih paket "${packageName}" dari daftar
5. Mulai bermain dan nikmati!

*PANDUAN GAMING:*
• Jaga controller dengan baik
• Simpan progress game secara berkala
• Pantau sisa waktu dengan ketik "SALDO"
• Ketik "STOP" kapan saja untuk mengakhiri sesi
• Hubungi operator jika ada masalah teknis

*PERINTAH BERGUNA:*
• "SALDO" - Cek sisa waktu paket
• "CEK TV" - Status ketersediaan TV
• "STOP" - Hentikan sesi gaming
• "HELP" - Menu bantuan lengkap

================================
${centerText('TERIMA KASIH ATAS')}
${centerText('KEPERCAYAAN ANDA!')}

${centerText('🎮 PS RENTAL - Game On! 🎮')}
================================`;
};

// Fungsi untuk mengirim notifikasi paket aktif
const sendPackageActivatedNotification = async (memberId, packageData) => {
    try {
        if (!whatsappClient) {
            console.error('WhatsApp client not initialized');
            return { success: false, error: 'WhatsApp client not available' };
        }

        // Ambil data member
        const member = await memberService.getMemberById(memberId);
        if (!member) {
            console.error('Member not found:', memberId);
            return { success: false, error: 'Member not found' };
        }

        // Format nomor WhatsApp
        let phoneNumber = member.phone_number;
        if (!phoneNumber.includes('@c.us')) {
            // Pastikan format WhatsApp yang benar
            if (phoneNumber.startsWith('+')) {
                phoneNumber = phoneNumber.substring(1) + '@c.us';
            } else if (phoneNumber.startsWith('0')) {
                phoneNumber = '62' + phoneNumber.substring(1) + '@c.us';
            } else {
                phoneNumber = phoneNumber + '@c.us';
            }
        }

        // Buat pesan notifikasi
        const message = createPackageActivatedMessage(member.name, packageData);

        // Kirim pesan
        await whatsappClient.sendMessage(phoneNumber, message);

        console.log(`Package activation notification sent to ${member.name} (${phoneNumber})`);
        return { success: true, message: 'Notification sent successfully' };

    } catch (error) {
        console.error('Error sending package activation notification:', error);
        return { success: false, error: error.message };
    }
};

// Template pesan untuk timeout notification
const createTimeoutNotificationMessage = (memberName, tvName, timeoutDuration) => {
    return `⏰ *WAKTU LOGIN HABIS*

┌─────────────────────────┐
│  ⚠️ *SESSION TIMEOUT*    │
└─────────────────────────┘

👋 Halo *${memberName}*!

📺 TV yang Anda pilih: *${tvName}*
⏱️ Waktu tunggu: *${timeoutDuration} menit*
❌ Status: *Login dibatalkan otomatis*

┌─────────────────────────┐
│  🔄 *CARA MAIN LAGI*     │
└─────────────────────────┘

1️⃣ *Scan QR code* di layar TV yang tersedia
2️⃣ *Ketik kode login* 8 digit dari TV
3️⃣ *Pilih paket* dalam waktu 2 menit
4️⃣ *Mulai gaming* dan have fun!

┌─────────────────────────┐
│  💡 *TIPS CEPAT*         │
└─────────────────────────┘

🚀 Siapkan pilihan paket sebelum scan QR
⚡ Respon cepat untuk menghindari timeout
📱 Pastikan koneksi WhatsApp stabil
🎮 TV masih tersedia untuk Anda

💬 *Butuh bantuan?* Ketik *HELP* atau hubungi operator

🎮 *PS Rental System* - Ready When You Are!`;
};

// Fungsi untuk mengirim timeout notification
const sendTimeoutNotification = async (phoneNumber, memberName, tvName, timeoutDuration = 2) => {
    try {
        if (!whatsappClient) {
            console.error('WhatsApp client not initialized');
            return { success: false, error: 'WhatsApp client not available' };
        }

        // Format nomor WhatsApp jika belum ada @c.us
        let formattedPhone = phoneNumber;
        if (!formattedPhone.includes('@c.us')) {
            if (formattedPhone.startsWith('+')) {
                formattedPhone = formattedPhone.substring(1) + '@c.us';
            } else if (formattedPhone.startsWith('0')) {
                formattedPhone = '62' + formattedPhone.substring(1) + '@c.us';
            } else {
                formattedPhone = formattedPhone + '@c.us';
            }
        }

        // Buat pesan timeout notification
        const message = createTimeoutNotificationMessage(memberName, tvName, timeoutDuration);

        // Kirim pesan
        await whatsappClient.sendMessage(formattedPhone, message);

        console.log(`⏰ Timeout notification sent to ${memberName} (${formattedPhone})`);
        return { success: true, message: 'Timeout notification sent successfully' };

    } catch (error) {
        console.error('Error sending timeout notification:', error);
        return { success: false, error: error.message };
    }
};

// Note: Welcome message functionality has been integrated directly into whatsapp.js
// to avoid duplicate messages. This service now handles package activation and timeout notifications.

module.exports = {
    setWhatsAppClient,
    sendPackageActivatedNotification,
    createPackageActivatedMessage,
    sendTimeoutNotification,
    createTimeoutNotificationMessage
};
