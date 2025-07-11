const cron = require('node-cron');
const db = require('../database').getInstance();
const { client: whatsappClient } = require('../whatsapp');

const CHECK_INTERVAL_MINUTES = 1;
const NOTIFICATION_THRESHOLD_MINUTES = 5;

/**
 * Mengirim notifikasi WhatsApp ke nomor telepon yang diberikan.
 * @param {string} phoneNumber Nomor telepon tujuan (format E.164, misal: 6281234567890@c.us)
 * @param {string} message Pesan yang akan dikirim.
 */
async function sendWhatsAppMessage(phoneNumber, message) {
    try {
        if (whatsappClient.info) { // Pastikan client sudah siap
            await whatsappClient.sendMessage(phoneNumber, message);
            console.log(`Notification sent to ${phoneNumber}`);
        }
    } catch (error) {
        console.error(`Failed to send WhatsApp message to ${phoneNumber}:`, error);
    }
}

/**
 * Memeriksa sesi TV yang akan berakhir dan mengirim notifikasi.
 */
async function checkAndNotifyExpiringSessions() {
    const now = new Date();
    const notificationTime = new Date(now.getTime() + NOTIFICATION_THRESHOLD_MINUTES * 60000);

    const query = `
        SELECT
            t.id AS tvId,
            t.name AS tvName,
            t.session_end_time AS endTime,
            m.name AS memberName,
            m.phone_number AS memberPhone
        FROM tvs t
        JOIN members m ON t.current_member_id = m.id
        WHERE t.status = 'active'
          AND t.session_end_time IS NOT NULL
          AND t.notification_sent = 0
          AND t.session_end_time > ?
          AND t.session_end_time <= ?
    `;

    db.all(query, [now.toISOString(), notificationTime.toISOString()], (err, sessions) => {
        if (err) {
            console.error('Error fetching expiring sessions:', err);
            return;
        }

        sessions.forEach(session => {
            const minutesLeft = Math.round((new Date(session.endTime) - now) / 60000);
            const message = `Halo, ${session.memberName}! Sesi Anda di ${session.tvName} akan berakhir dalam ${minutesLeft} menit.`;
            sendWhatsAppMessage(session.memberPhone, message);

            // Tandai notifikasi sebagai terkirim
            db.run('UPDATE tvs SET notification_sent = 1 WHERE id = ?', [session.tvId], (updateErr) => {
                if (updateErr) {
                    console.error(`Failed to mark notification as sent for TV ${session.tvId}:`, updateErr);
                }
            });
        });
    });
}

/**
 * Memulai cron job untuk memeriksa sesi yang akan berakhir secara berkala.
 */
function startNotificationService() {
    console.log('Notification service started. Checking for expiring sessions every minute.');
    // Jalankan setiap menit
    cron.schedule('* * * * *', () => {
        console.log('Running scheduled check for expiring sessions...');
        checkAndNotifyExpiringSessions();
    });
}

module.exports = { startNotificationService };