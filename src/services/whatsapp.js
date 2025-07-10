const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const { db } = require('../database/database');
const sessionManager = require('./sessionManager');

class WhatsAppService {
  constructor() {
    this.client = null;
    this.io = null;
    this.isReady = false;
    this.qrString = '';
  }

  init(io) {
    this.io = io;
    this.client = new Client({
      authStrategy: new LocalAuth({
        clientId: 'billing-ps'
      }),
      puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      }
    });

    this.setupEventHandlers();
    this.client.initialize();
  }

  setupEventHandlers() {
    this.client.on('qr', (qr) => {
      console.log('📱 WhatsApp QR Code generated');
      this.qrString = qr;
      
      // Generate QR code as data URL
      qrcode.toDataURL(qr, (err, url) => {
        if (!err) {
          this.io.emit('wa-qr', { qr: url });
        }
      });
    });

    this.client.on('ready', () => {
      console.log('✅ WhatsApp Client is ready!');
      this.isReady = true;
      this.io.emit('wa-ready', { status: 'connected' });
    });

    this.client.on('authenticated', () => {
      console.log('✅ WhatsApp authenticated');
    });

    this.client.on('auth_failure', (msg) => {
      console.error('❌ WhatsApp authentication failed:', msg);
      this.io.emit('wa-error', { error: 'Authentication failed' });
    });

    this.client.on('disconnected', (reason) => {
      console.log('❌ WhatsApp disconnected:', reason);
      this.isReady = false;
      this.io.emit('wa-disconnected', { reason });
    });

    this.client.on('message', async (message) => {
      await this.handleIncomingMessage(message);
    });
  }

  async handleIncomingMessage(message) {
    try {
      const phone = message.from.replace('@c.us', '');
      const text = message.body.trim();
      
      // Log message
      db.run(
        'INSERT INTO wa_messages (phone, message, type) VALUES (?, ?, ?)',
        [phone, text, 'incoming']
      );

      console.log(`📨 Message from ${phone}: ${text}`);

      // Check if message is TV login request
      const tvMatch = text.match(/^(TV\d+)$/i);
      if (tvMatch) {
        const tvId = tvMatch[1].toUpperCase();
        await this.handleTVLogin(phone, tvId, message);
        return;
      }

      // Check if message is package selection
      const packageMatch = text.match(/^(\d+)$/);
      if (packageMatch) {
        const packageId = parseInt(packageMatch[1]);
        await this.handlePackageSelection(phone, packageId, message);
        return;
      }

      // Default response
      await this.sendMessage(phone, 
        '🎮 *Selamat datang di Rental PS!*\n\n' +
        'Untuk memulai bermain:\n' +
        '1. Scan QR code di TV\n' +
        '2. Kirim kode TV (contoh: TV01)\n' +
        '3. Pilih paket yang tersedia\n\n' +
        'Ketik *HELP* untuk bantuan lebih lanjut.'
      );
    } catch (error) {
      console.error('Error handling message:', error);
    }
  }

  async handleTVLogin(phone, tvId, message) {
    try {
      // Check if TV exists and is available
      db.get(
        'SELECT * FROM tvs WHERE tv_id = ? AND is_paired = 1',
        [tvId],
        async (err, tv) => {
          if (err || !tv) {
            await this.sendMessage(phone, 
              `❌ TV ${tvId} tidak ditemukan atau belum terpasang.\n\n` +
              'Silakan hubungi operator untuk bantuan.'
            );
            return;
          }

          // Check if TV is currently in use
          db.get(
            'SELECT * FROM sessions WHERE tv_id = ? AND status = "active"',
            [tvId],
            async (err, activeSession) => {
              if (activeSession) {
                await this.sendMessage(phone, 
                  `⏰ TV ${tvId} sedang digunakan.\n\n` +
                  'Silakan pilih TV lain atau tunggu hingga selesai.'
                );
                return;
              }

              // Get or create member
              await this.getOrCreateMember(phone, async (member) => {
                // Show available packages
                await this.showAvailablePackages(phone, tvId, member);
              });
            }
          );
        }
      );
    } catch (error) {
      console.error('Error handling TV login:', error);
    }
  }

  async handlePackageSelection(phone, packageId, message) {
    try {
      // Get pending TV login for this phone
      const recentMessage = await this.getRecentTVMessage(phone);
      if (!recentMessage) {
        await this.sendMessage(phone, 
          '❌ Sesi login tidak ditemukan.\n\n' +
          'Silakan scan QR code di TV terlebih dahulu.'
        );
        return;
      }

      // Get package details
      db.get(
        'SELECT * FROM packages WHERE id = ? AND is_active = 1',
        [packageId],
        async (err, package) => {
          if (err || !package) {
            await this.sendMessage(phone, 
              '❌ Paket tidak valid.\n\n' +
              'Silakan pilih nomor paket yang tersedia.'
            );
            return;
          }

          // Get member
          await this.getOrCreateMember(phone, async (member) => {
            // Check if member has this package
            db.get(
              'SELECT * FROM member_packages WHERE member_id = ? AND package_id = ? AND quantity > 0',
              [member.id, packageId],
              async (err, memberPackage) => {
                if (memberPackage) {
                  // Use member's package
                  await this.activateSession(recentMessage.tvId, member, package, 'whatsapp');
                  
                  // Decrease package quantity
                  db.run(
                    'UPDATE member_packages SET quantity = quantity - 1 WHERE id = ?',
                    [memberPackage.id]
                  );
                  
                  await this.sendMessage(phone, 
                    `✅ *Sesi dimulai!*\n\n` +
                    `📺 TV: ${recentMessage.tvId}\n` +
                    `⏱️ Durasi: ${package.name}\n` +
                    `🎮 Selamat bermain!\n\n` +
                    `Sisa paket ${package.name}: ${memberPackage.quantity - 1}`
                  );
                } else {
                  // Member doesn't have this package
                  await this.sendMessage(phone, 
                    `❌ Anda tidak memiliki paket ${package.name}.\n\n` +
                    `💰 Harga: Rp ${package.price.toLocaleString()}\n\n` +
                    'Silakan hubungi operator untuk pembelian paket.'
                  );
                }
              }
            );
          });
        }
      );
    } catch (error) {
      console.error('Error handling package selection:', error);
    }
  }

  async getRecentTVMessage(phone) {
    return new Promise((resolve) => {
      db.get(
        `SELECT message as tvId FROM wa_messages 
         WHERE phone = ? AND message LIKE 'TV%' 
         ORDER BY created_at DESC LIMIT 1`,
        [phone],
        (err, row) => {
          resolve(row);
        }
      );
    });
  }

  async getOrCreateMember(phone, callback) {
    db.get(
      'SELECT * FROM members WHERE phone = ?',
      [phone],
      (err, member) => {
        if (member) {
          callback(member);
        } else {
          // Create new member
          db.run(
            'INSERT INTO members (phone) VALUES (?)',
            [phone],
            function(err) {
              if (!err) {
                const newMember = { id: this.lastID, phone };
                callback(newMember);
              }
            }
          );
        }
      }
    );
  }

  async showAvailablePackages(phone, tvId, member) {
    db.all(
      'SELECT * FROM packages WHERE is_active = 1 ORDER BY duration_minutes',
      [],
      async (err, packages) => {
        if (err || !packages.length) {
          await this.sendMessage(phone, '❌ Tidak ada paket tersedia.');
          return;
        }

        let message = `🎮 *Pilih Paket untuk ${tvId}*\n\n`;
        
        for (let i = 0; i < packages.length; i++) {
          const pkg = packages[i];
          
          // Check if member has this package
          const memberPackage = await this.getMemberPackage(member.id, pkg.id);
          const quantity = memberPackage ? memberPackage.quantity : 0;
          
          message += `${pkg.id}. *${pkg.name}* - Rp ${pkg.price.toLocaleString()}`;
          if (quantity > 0) {
            message += ` ✅ (Tersedia: ${quantity})`;
          } else {
            message += ` ❌ (Tidak tersedia)`;
          }
          message += `\n`;
        }
        
        message += `\n💡 Ketik nomor paket untuk memulai bermain.`;
        
        await this.sendMessage(phone, message);
      }
    );
  }

  async getMemberPackage(memberId, packageId) {
    return new Promise((resolve) => {
      db.get(
        'SELECT * FROM member_packages WHERE member_id = ? AND package_id = ?',
        [memberId, packageId],
        (err, row) => {
          resolve(row);
        }
      );
    });
  }

  async activateSession(tvId, member, package, createdBy) {
    const startTime = new Date().toISOString();
    const endTime = new Date(Date.now() + package.duration_minutes * 60000).toISOString();
    
    db.run(
      `INSERT INTO sessions (tv_id, member_id, package_id, duration_minutes, start_time, end_time, created_by) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [tvId, member.id, package.id, package.duration_minutes, startTime, endTime, createdBy],
      function(err) {
        if (!err) {
          // Notify session manager
          sessionManager.startSession({
            id: this.lastID,
            tvId,
            memberId: member.id,
            packageId: package.id,
            duration: package.duration_minutes,
            startTime,
            endTime
          });
        }
      }
    );
  }

  async sendMessage(phone, text) {
    if (!this.isReady) {
      console.log('WhatsApp not ready, cannot send message');
      return false;
    }

    try {
      const chatId = phone + '@c.us';
      await this.client.sendMessage(chatId, text);
      
      // Log outgoing message
      db.run(
        'INSERT INTO wa_messages (phone, message, type) VALUES (?, ?, ?)',
        [phone, text, 'outgoing']
      );
      
      return true;
    } catch (error) {
      console.error('Error sending WhatsApp message:', error);
      return false;
    }
  }

  getStatus() {
    return {
      isReady: this.isReady,
      qrString: this.qrString
    };
  }
}

module.exports = new WhatsAppService();