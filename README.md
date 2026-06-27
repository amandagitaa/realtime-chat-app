# Realtime Chat App

# 📌 Deskripsi Project

Realtime Chat App adalah aplikasi chatting yang mendukung komunikasi dua arah secara realtime antar user menggunakan WebSocket melalui Socket.io.

Project ini dibuat untuk mempelajari:

* Realtime communication
* Client-server architecture
* Socket programming
* Database integration
* File upload
* Authentication system

---

# 🚀 Features

## 1. Register & Login

User dapat:

* Membuat akun baru
* Login menggunakan username dan password

Password disimpan secara aman menggunakan **bcrypt hashing**.

---

## 2. Realtime Messaging

Pesan terkirim secara realtime tanpa refresh browser.

Fitur:

* Kirim pesan teks
* Terima pesan langsung
* Chat 2 arah

---

## 3. Chat History

Semua pesan disimpan ke database MySQL.

Keuntungan:

* Chat tidak hilang saat refresh
* History tetap ada setelah login ulang

---

## 4. Online / Offline Status

User dapat melihat status kontak:

### Online

Kontak sedang aktif.

### Offline

Kontak sedang tidak aktif.

Jika offline, aplikasi menampilkan:

```text
Last seen: 7/27/2026, 10:35 PM
```

---

## 5. Typing Indicator

Saat user sedang mengetik, lawan bicara akan melihat:

```text
Amanda is typing...
```

Indicator otomatis hilang ketika user berhenti mengetik.

---

## 6. Message Status

Setiap pesan memiliki status:

### Sent

Pesan berhasil masuk server.

Simbol:

```text
✓
```

---

### Delivered

Pesan berhasil sampai ke device penerima.

Simbol:

```text
✓✓
```

---

### Read

Pesan sudah dibaca.

Simbol:

```text
✓✓ (biru)
```

Mirip WhatsApp.

---

## 7. Unread Badge

Jika ada pesan baru yang belum dibuka:

Contoh:

```text
Dinda (3)
```

Artinya ada 3 pesan belum dibaca.

---

## 8. Search Contact

User dapat mencari kontak melalui search bar.

Contoh:

Input:

```text
Din
```

Output:

```text
Dinda
```

---

## 9. File Upload

User dapat mengirim:

### Image

Format:

* JPG
* JPEG
* PNG

Gambar langsung tampil di chat.

---


# 🛠 Tech Stack

## Frontend

* HTML
* CSS
* JavaScript

## Backend

* Node.js
* Express.js
* Socket.io

## Database

* MySQL

## Libraries

* bcrypt
* mysql2
* multer
* socket.io

---

# 📂 Project Structure

```bash
chat-app/
│
├── public/
│   ├── script.js
│   └── style.css
│
├── views/
│   ├── login.html
│   └── chat.html
│
├── server.js
├── package.json
└── README.md
```

---

# ⚙ Installation

## 1. Clone repository

```bash
git clone <repository-url>
```

---

## 2. Install dependencies

```bash
npm install
```

Jika belum ada package:

```bash
npm install express socket.io mysql2 bcrypt multer
```

---

## 3. Setup Database

Buat database:

```sql
CREATE DATABASE chat_app;
```

Import tabel:

* users
* messages

---

## 4. Configure Database

Edit file:

```text
server.js
```

Sesuaikan konfigurasi:

```javascript
const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "chat_app"
});
```

---

## 5. Run Server

```bash
node server.js
```

Server berjalan di:

```text
http://localhost:3000
```

---

# 🔄 Workflow

1. User register
2. User login
3. Socket terhubung
4. User online
5. User memilih kontak
6. Pesan dikirim
7. Data masuk MySQL
8. Receiver menerima pesan realtime
9. Status berubah:

   * sent
   * delivered
   * read

---

# 🔐 Security

Project menggunakan:

* Password hashing dengan bcrypt
* Validasi input dasar
* File upload handling dengan multer

---

Nama    : Amanda Gita Syafitri
Kelas   : A3
