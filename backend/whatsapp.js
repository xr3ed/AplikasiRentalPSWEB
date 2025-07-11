const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { getMemberByPhone, createMemberInternal } = require('./services/memberService');
const userContext = {};
const tvService = require('./services/tvService');
const packageService = require('./services/packageService');

const client = new Client({
    authStrategy: new LocalAuth()
});

client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('WhatsApp client is ready!');
});

client.on('message', async message => {
    const sender = message.from; // Nomor pengirim
    const body = message.body.trim();
    const lowerBody = body.toLowerCase();

    try {
        const member = await getMemberByPhone(sender);

        // Regex untuk mencocokkan format TV<ID>, misalnya TV01, TV1, tv2
        const tvIdMatch = body.match(/^TV(\d+)$/i);

        if (tvIdMatch) {
            const tvId = parseInt(tvIdMatch[1], 10);
            const tv = await tvService.getTvById(tvId);

            if (!tv) {
                return message.reply(`TV dengan ID ${tvId} tidak ditemukan.`);
            }

            if (!member) {
                return message.reply('Nomor Anda belum terdaftar. Silakan daftar dengan format: DAFTAR <Nama Anda>');
            }

            // Simpan konteks untuk pengguna ini
            // Di aplikasi nyata, ini akan disimpan di database atau cache (misal: Redis)
            // Untuk sekarang, kita simpan di memori (tidak ideal untuk produksi)
            userContext[sender] = { stage: 'select_package', tvId };

            const packages = await packageService.getAllPackages();
            if (!packages.length) {
                return message.reply('Saat ini tidak ada paket yang tersedia.');
            }

            let replyText = `Halo, ${member.name}! Pilih paket untuk TV${tvId}:\n`;
            packages.forEach((pkg, index) => {
                replyText += `\n${index + 1}. ${pkg.name} - ${pkg.duration_minutes} menit`;
            });
            replyText += '\n\nBalas dengan nomor paket yang Anda inginkan.';
            return message.reply(replyText);

        } else if (userContext[sender] && userContext[sender].stage === 'select_package') {
            const choice = parseInt(body, 10);
            const packages = await packageService.getAllPackages();
            
            if (isNaN(choice) || choice < 1 || choice > packages.length) {
                return message.reply('Pilihan tidak valid. Silakan balas dengan nomor paket yang benar.');
            }

            const selectedPackage = packages[choice - 1];
            const { tvId } = userContext[sender];

            try {
                await tvService.startPackageSession(tvId, selectedPackage.id);
                message.reply(`Sesi Anda di TV${tvId} dengan paket ${selectedPackage.name} telah dimulai!`);
            } catch (error) {
                message.reply(`Gagal memulai sesi: ${error.message}`);
            }
            
            // Hapus konteks setelah selesai
            delete userContext[sender];

        } else if (lowerBody.startsWith('daftar ')) {
            if (member) {
                return message.reply('Nomor Anda sudah terdaftar.');
            }
            const name = body.substring(7).trim();
            if (name) {
                await createMemberInternal({ name, phone: sender });
                message.reply(`Pendaftaran berhasil! Selamat datang, ${name}.`);
            } else {
                message.reply('Format pendaftaran salah. Gunakan: DAFTAR <Nama Anda>');
            }
        } else if (lowerBody === '!ping') {
            message.reply('pong');
        } else {
            // Pesan default jika tidak ada perintah yang cocok
            message.reply('Perintah tidak dikenali. Untuk memulai sesi, pindai QR di TV Anda.');
        }
    } catch (error) {
        console.error('Error handling WhatsApp message:', error);
        message.reply('Terjadi kesalahan di server. Silakan coba lagi nanti.');
    }
});

function initializeWhatsAppClient() {
    client.initialize().catch(err => console.error('WhatsApp client initialization error:', err));
}

module.exports = { client, initializeWhatsAppClient };