# Proyek: Aplikasi Billing Rental PS

## Ringkasan Proyek

Proyek ini adalah sistem billing untuk rental PlayStation yang dirancang dengan arsitektur modern. Sistem ini terdiri dari backend berbasis Node.js, frontend web menggunakan Next.js, dan aplikasi helper untuk Android TV. Tujuannya adalah untuk mengotomatiskan dan mempermudah pengelolaan sesi rental, manajemen member, dan pelaporan transaksi.

## Arsitektur & Teknologi

*   **Backend**: Node.js (Express.js) dengan database SQLite.
*   **Frontend**: Next.js (React) dengan Tailwind CSS.
*   **Aplikasi TV**: Aplikasi Android native (Kotlin) untuk menampilkan QR code, status sesi, dan kontrol dasar.
*   **Komunikasi**:
    *   Lokal: WebSocket dan UDP Broadcast untuk komunikasi real-time antara server dan TV.
    *   Online: Integrasi dengan WhatsApp (menggunakan `whatsapp-web.js`) untuk login member dan aktivasi sesi mandiri.

## Fitur Utama (Berdasarkan Desain)

*   **Manajemen TV**: Menambah, memberi nama, dan memonitor status setiap TV secara real-time.
*   **Pairing Otomatis**: TV dapat melakukan pairing dengan server secara otomatis saat dinyalakan.
*   **Sistem Sesi**: Admin/Operator dapat memulai, menghentikan, dan menambah durasi sesi dari dashboard.
*   **Manajemen Member & Paket**: Mengelola data member dan paket prabayar yang bisa dibeli atau digunakan.
*   **Login via WhatsApp**: Member dapat memulai sesi dengan memindai QR code di TV, yang akan mengirim pesan WhatsApp ke server.
*   **Notifikasi Otomatis**: Notifikasi dikirim ke WhatsApp operator ketika sesi akan berakhir.
*   **Pelaporan**: Pencatatan semua transaksi keuangan untuk pelaporan.
*   **Hak Akses**: Sistem peran untuk Admin dan Operator dengan hak akses yang berbeda.

## Log Pengembangan (Ringkasan)

Proyek ini telah melalui beberapa fase pengembangan utama:

1.  **Inisialisasi (Juli 2024)**: Pengaturan awal proyek dengan backend Node.js/Express dan frontend Next.js.
2.  **Implementasi Fitur Inti**:
    *   **Manajemen TV, Member, & Paket**: Pembuatan API dan halaman antarmuka untuk operasi CRUD dasar.
    *   **Otentikasi**: Implementasi sistem login dengan JWT untuk Admin dan Operator.
    *   **Manajemen Sesi**: Pengembangan logika untuk memulai dan menghentikan sesi dari dashboard.
3.  **Integrasi WhatsApp (Akhir Juli 2024)**:
    *   Mengintegrasikan `whatsapp-web.js` untuk menangani pesan masuk.
    *   Mengembangkan alur kerja di mana member dapat memulai sesi dengan mengirim pesan `TV<ID>` dan memilih paket.
4.  **Refaktorisasi & Peningkatan Kualitas**:
    *   Memperkenalkan lapisan `Service` di backend untuk memisahkan logika bisnis dari `Controller`, meningkatkan modularitas.
    *   Memperbaiki berbagai bug, termasuk masalah `hydration-mismatch` di frontend dan kendala unik pada database.
5.  **Pengembangan Aplikasi Android TV (Awal Agustus 2024)**:
    *   Mengembangkan aplikasi helper untuk menampilkan QR code pendaftaran.
    *   Mengimplementasikan penemuan server menggunakan broadcast UDP untuk koneksi yang lebih cepat.
    *   Menambahkan fitur auto-start agar aplikasi berjalan otomatis saat TV dinyalakan.
    *   Memperbaiki bug flickering dan masalah identifikasi TV yang tidak lagi bergantung pada alamat IP.
6.  **Penyempurnaan Fitur**:
    *   Implementasi notifikasi WhatsApp untuk sesi yang akan berakhir.
    *   Penambahan fitur pelaporan transaksi keuangan.
    *   Penonaktifan sementara fitur login untuk menyederhanakan alur pengembangan.

## Status Saat Ini

Proyek berada dalam tahap pengembangan aktif. Fitur-fitur inti seperti manajemen TV, sesi, member, paket, dan integrasi WhatsApp telah diimplementasikan. Aplikasi helper Android TV juga sudah fungsional dengan fitur penemuan dan auto-start. Fokus saat ini adalah pada penyempurnaan alur kerja, perbaikan bug, dan penambahan fitur berdasarkan `design.txt`.

## Pedoman Kerja

*   **Selalu Update Dev Log**: Setelah menyelesaikan sebuah tugas atau membuat perubahan signifikan, selalu catat pekerjaan yang telah dilakukan di `dev_log.txt`.
*   **Pahami Konteks**: Sebelum melakukan perubahan, pahami terlebih dahulu kode yang ada, `design.txt`, dan `dev_log.txt` untuk memastikan konsistensi.
*   **Jangan Jalankan Server**: Saya (pengguna) akan bertanggung jawab untuk menjalankan perintah `npm run dev` atau `npm start` untuk backend dan frontend. Jangan menjalankan perintah ini.