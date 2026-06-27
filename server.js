const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mysql = require("mysql2");
const bcrypt = require("bcrypt");
const multer = require("multer");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*"
    }
});

app.use(express.static("public"));
app.use(express.json());

/* ================= VIEWS ROUTE ================= */
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "views", "login.html"));
});

app.get("/chat", (req, res) => {
    res.sendFile(path.join(__dirname, "views", "chat.html"));
});

/* ================= DATABASE ================= */
const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "chat_app"
});

db.connect((err) => {
    if (err) {
        console.log("❌ Database gagal connect:", err);
        return;
    }
    console.log("✅ MySQL Connected");
});

app.use("/uploads", express.static("uploads"));

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "uploads/");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage });

/* ================= REGISTER ================= */
app.post("/register", async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.json({
            success: false,
            message: "Username dan password wajib"
        });
    }

    db.query(
        "SELECT * FROM users WHERE username = ?",
        [username],
        async (err, result) => {
            if (err) {
                return res.json({ success: false, message: "Database error" });
            }

            if (result.length > 0) {
                return res.json({
                    success: false,
                    message: "Username sudah dipakai"
                });
            }

            const hashedPassword = await bcrypt.hash(password, 10);

            db.query(
                "INSERT INTO users (username, password) VALUES (?, ?)",
                [username, hashedPassword],
                (err) => {
                    if (err) {
                        console.log(err);
                        return res.json({
                            success: false,
                            message: "Register gagal"
                        });
                    }

                    res.json({
                        success: true,
                        message: "Register berhasil"
                    });
                }
            );
        }
    );
});

/* ================= LOGIN ================= */
app.post("/login", (req, res) => {
    const { username, password } = req.body;

    db.query(
        "SELECT * FROM users WHERE username = ?",
        [username],
        async (err, result) => {
            if (err) {
                return res.json({ success: false, message: "Database error" });
            }

            if (result.length === 0) {
                return res.json({
                    success: false,
                    message: "User tidak ditemukan"
                });
            }

            const user = result[0];
            const match = await bcrypt.compare(password, user.password);

            if (!match) {
                return res.json({
                    success: false,
                    message: "Password salah"
                });
            }

            res.json({
                success: true,
                username: user.username
            });
        }
    );
});

/* ================= CHAT HISTORY ================= */
app.get("/messages/:user1/:user2", (req, res) => {
    const { user1, user2 } = req.params;

    db.query(
        `SELECT * FROM messages
         WHERE (sender=? AND receiver=?)
         OR (sender=? AND receiver=?)
         ORDER BY created_at ASC`,
        [user1, user2, user2, user1],
        (err, results) => {
            if (err) {
                console.log(err);
                return res.json([]);
            }
            res.json(results);
        }
    );
});

let onlineUsers = {};
let lastSeen = {};

/* ================= MARK READ ================= */
app.post("/mark-read", (req, res) => {
    const { sender, receiver } = req.body;

    db.query(
        "UPDATE messages SET status='read' WHERE sender=? AND receiver=?",
        [sender, receiver],
        (err) => {
            if (err) {
                console.log(err);
                return res.json({ success: false });
            }

            const senderSocket = onlineUsers[sender];

            if (senderSocket) {
                io.to(senderSocket).emit("update_read_status", {
                    sender,
                    receiver
                });
            }

            res.json({ success: true });
        }
    );
});

/* ================= LAST MESSAGE ================= */
app.get("/last-messages/:username", (req, res) => {
    const username = req.params.username;

    db.query(
        `
        SELECT m.sender, m.receiver, m.message, m.created_at
        FROM messages m
        INNER JOIN (
            SELECT 
                CASE 
                    WHEN sender = ? THEN receiver
                    ELSE sender
                END as chat_user,
                MAX(id) as last_id
            FROM messages
            WHERE sender = ? OR receiver = ?
            GROUP BY chat_user
        ) last_chat
        ON m.id = last_chat.last_id
        ORDER BY m.created_at DESC
        `,
        [username, username, username],
        (err, results) => {
            if (err) {
                console.log(err);
                return res.json([]);
            }

            res.json(results);
        }
    );
});

/* ================= UPLOAD FILE ================= */
app.post("/upload", upload.single("file"), (req, res) => {
    const { sender, receiver } = req.body;

    if (!req.file) {
        return res.json({
            success: false,
            message: "File tidak ada"
        });
    }

    const fileUrl = "/uploads/" + req.file.filename;
    let messageType = "file";

    if (req.file.mimetype.startsWith("image/")) {
        messageType = "image";
    }

    db.query(
        `INSERT INTO messages 
        (sender, receiver, message, file_url, message_type, status)
        VALUES (?, ?, ?, ?, ?, ?)`,
        [sender, receiver, req.file.originalname, fileUrl, messageType, "sent"],
        (err) => {
            if (err) {
                console.log(err);
                return res.json({ success: false });
            }

            const receiverSocket = onlineUsers[receiver];

            const messageData = {
                sender,
                receiver,
                message: req.file.originalname,
                file_url: fileUrl,
                message_type: messageType,
                status: receiverSocket ? "delivered" : "sent",
                created_at: new Date()
            };

            if (receiverSocket) {
                io.to(receiverSocket).emit("receive_message", messageData);
            }

            res.json({
                success: true,
                data: messageData
            });
        }
    );
});

/* ================= SOCKET ================= */
io.on("connection", (socket) => {
    console.log("🟢 User connected:", socket.id);

    socket.on("register_socket", (username) => {
        onlineUsers[username] = socket.id;
        io.emit("online_users", Object.keys(onlineUsers));
    });

    socket.on("send_message", (data) => {
        const { sender, receiver, message } = data;
        const receiverSocket = onlineUsers[receiver];

        let status = receiverSocket ? "delivered" : "sent";

        db.query(
            "INSERT INTO messages (sender, receiver, message, status) VALUES (?, ?, ?, ?)",
            [sender, receiver, message, status],
            (err) => {
                if (err) {
                    console.log(err);
                    return;
                }

                const messageData = {
                    sender,
                    receiver,
                    message,
                    status,
                    created_at: new Date()
                };

                if (receiverSocket) {
                    io.to(receiverSocket).emit("receive_message", messageData);
                }

                socket.emit("receive_message", messageData);
            }
        );
    });

    socket.on("message_read", (data) => {
        const { sender, receiver } = data;

        db.query(
            "UPDATE messages SET status='read' WHERE sender=? AND receiver=?",
            [sender, receiver],
            (err) => {
                if (err) {
                    console.log(err);
                    return;
                }

                const senderSocket = onlineUsers[sender];

                if (senderSocket) {
                    io.to(senderSocket).emit("update_read_status", data);
                }
            }
        );
    });

    socket.on("typing", (data) => {
        const receiverSocket = onlineUsers[data.receiver];
        if (receiverSocket) {
            io.to(receiverSocket).emit("show_typing", data.sender);
        }
    });

    socket.on("stop_typing", (data) => {
        const receiverSocket = onlineUsers[data.receiver];
        if (receiverSocket) {
            io.to(receiverSocket).emit("hide_typing");
        }
    });

    socket.on("check_status", (username) => {
        if (onlineUsers[username]) {
            socket.emit("status_result", {
                online: true,
                lastSeen: null
            });
        } else {
            socket.emit("status_result", {
                online: false,
                lastSeen: lastSeen[username] || "Unknown"
            });
        }
    });

    socket.on("disconnect", () => {
        for (let username in onlineUsers) {
            if (onlineUsers[username] === socket.id) {
                lastSeen[username] = new Date().toLocaleString();
                delete onlineUsers[username];
                break;
            }
        }

        io.emit("online_users", Object.keys(onlineUsers));
    });
});

server.listen(3000, "0.0.0.0", () => {
    console.log("🚀 Server berjalan di port 3000");
});