const socket = io();

const myUsername = localStorage.getItem("username");
let selectedUser = "";
let typingTimeout;
let unreadCounts = {};
let onlineUsersList = [];
let searchKeyword = "";

if (!myUsername) {
    window.location.href = "login.html";
}

// Hide input area saat awal
const chatInputArea = document.getElementById("chatInputArea");
if (chatInputArea) {
    chatInputArea.style.display = "none";
}

// ================= CONNECT SOCKET =================
socket.on("connect", () => {
    console.log("Socket connected:", socket.id);
    socket.emit("register_socket", myUsername);
});

// ================= ONLINE USERS =================
socket.on("online_users", async (users) => {
    onlineUsersList = users;
    await loadContacts(users);

    if (selectedUser !== "") {
        socket.emit("check_status", selectedUser);
    }
});

// ================= FORMAT TIME =================
function formatTime(datetime) {
    if (!datetime) return "";

    const date = new Date(datetime);
    const hour = String(date.getHours()).padStart(2, "0");
    const minute = String(date.getMinutes()).padStart(2, "0");

    return `${hour}:${minute}`;
}

// ================= LOAD CONTACTS =================
async function loadContacts(users) {
    const usersDiv = document.getElementById("users");
    usersDiv.innerHTML = "";

    const res = await fetch(`/last-messages/${myUsername}`);
    const lastMessages = await res.json();

    users.forEach(user => {
        if (
            searchKeyword &&
            !user.toLowerCase().includes(searchKeyword.toLowerCase())
        ) return;

        if (user === myUsername) return;

        let preview = "";
        let time = "";

        const msg = lastMessages.find(
            m =>
                (m.sender === user && m.receiver === myUsername) ||
                (m.receiver === user && m.sender === myUsername)
        );

        if (msg) {
            preview = msg.message;
            time = formatTime(msg.created_at);
        }

        const unread = unreadCounts[user] || 0;

        usersDiv.innerHTML += `
            <div class="user-item" onclick="selectUser('${user}')">
                <div style="display:flex; justify-content:space-between;">
                    <b>${user}</b>
                    <small>${time}</small>
                </div>

                <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px;">
                    <small>${preview}</small>
                    ${unread > 0 ? `<span class="unread-badge">${unread}</span>` : ""}
                </div>
            </div>
        `;
    });
}

// ================= STATUS =================
socket.on("status_result", (data) => {
    const status = document.getElementById("userStatus");
    if (!status) return;

    status.innerText = data.online
        ? "Online"
        : `Last seen: ${data.lastSeen}`;
});

// ================= SELECT USER =================
async function selectUser(username) {
    selectedUser = username;
    unreadCounts[username] = 0;

    const inputArea = document.getElementById("chatInputArea");
    if (inputArea) inputArea.style.display = "flex";

    const emptyState = document.getElementById("emptyState");
    if (emptyState) emptyState.style.display = "none";

    await loadContacts(onlineUsersList);

    document.getElementById("chatWith").innerText = username;

    socket.emit("check_status", username);

    socket.emit("message_read", {
        sender: username,
        receiver: myUsername
    });

    await fetch("/mark-read", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            sender: username,
            receiver: myUsername
        })
    });

    const chatBox = document.getElementById("chatBox");
    chatBox.innerHTML = "";

    const res = await fetch(`/messages/${myUsername}/${username}`);
    const messages = await res.json();

    messages.forEach(msg => appendMessage(msg));

    document.getElementById("message").focus();
}

// ================= SEND MESSAGE =================
function sendMessage() {
    const input = document.getElementById("message");
    const message = input.value.trim();

    if (message === "" || selectedUser === "") return;

    socket.emit("send_message", {
        sender: myUsername,
        receiver: selectedUser,
        message: message
    });

    input.value = "";
    input.focus();
}

// ================= FILE UPLOAD =================
document.getElementById("fileInput").addEventListener("change", async function () {
    const file = this.files[0];
    if (!file || selectedUser === "") return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("sender", myUsername);
    formData.append("receiver", selectedUser);

    try {
        const res = await fetch("/upload", {
            method: "POST",
            body: formData
        });

        const result = await res.json();

        if (result.success) {
            appendMessage(result.data);
            await loadContacts(onlineUsersList);
        } else {
            alert("Upload gagal");
        }
    } catch (err) {
        console.log(err);
        alert("Upload error");
    }

    this.value = "";
});

// ================= RECEIVE MESSAGE =================
socket.on("receive_message", async (data) => {
    if (
        data.sender !== myUsername &&
        data.sender === selectedUser
    ) {
        socket.emit("message_read", {
            sender: data.sender,
            receiver: myUsername
        });
    }

    if (data.sender !== myUsername && data.sender !== selectedUser) {
        unreadCounts[data.sender] =
            (unreadCounts[data.sender] || 0) + 1;
    }

    if (
        data.sender === selectedUser ||
        data.receiver === selectedUser
    ) {
        appendMessage(data);
    }

    await loadContacts(onlineUsersList);
});

// ================= UPDATE READ STATUS =================
socket.on("update_read_status", () => {
    document.querySelectorAll(".message.me .status-check").forEach(el => {
        if (el.innerText.includes("✓")) {
            el.style.color = "#4FC3F7";
        }
    });
});

// ================= APPEND MESSAGE =================
function appendMessage(data) {
    const chatBox = document.getElementById("chatBox");
    const div = document.createElement("div");

    div.classList.add("message");
    div.classList.add(data.sender === myUsername ? "me" : "other");

    let statusIcon = "";
    let statusColor = "white";

    if (data.status === "sent") {
        statusIcon = "✓";
    } else if (data.status === "delivered") {
        statusIcon = "✓✓";
    } else if (data.status === "read") {
        statusIcon = "✓✓";
        statusColor = "#4FC3F7";
    }

    const time = formatTime(data.created_at || new Date());

    let content = "";

    if (data.message_type === "image") {
        content = `
            <img src="${data.file_url}" style="
                max-width:220px;
                border-radius:12px;
                display:block;
            ">
        `;
    } else if (data.message_type === "file") {
        content = `
            <a href="${data.file_url}" target="_blank"
               style="color:${data.sender === myUsername ? "white" : "black"};">
                📄 ${data.message}
            </a>
        `;
    } else {
        content = `<div>${data.message}</div>`;
    }

    div.innerHTML = `
        ${content}
        <div style="
            font-size:11px;
            margin-top:4px;
            display:flex;
            justify-content:flex-end;
            gap:4px;
            align-items:center;
        ">
            <span>${time}</span>
            ${
                data.sender === myUsername
                    ? `<span class="status-check" style="color:${statusColor};">${statusIcon}</span>`
                    : ""
            }
        </div>
    `;

    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
}

// ================= TYPING =================
document.getElementById("message").addEventListener("input", () => {
    if (selectedUser === "") return;

    socket.emit("typing", {
        sender: myUsername,
        receiver: selectedUser
    });

    clearTimeout(typingTimeout);

    typingTimeout = setTimeout(() => {
        socket.emit("stop_typing", {
            sender: myUsername,
            receiver: selectedUser
        });
    }, 1000);
});

socket.on("show_typing", (username) => {
    const typing = document.getElementById("typingIndicator");
    if (typing) typing.innerText = `${username} is typing...`;
});

socket.on("hide_typing", () => {
    const typing = document.getElementById("typingIndicator");
    if (typing) typing.innerText = "";
});

// ================= ENTER TO SEND =================
document.getElementById("message").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        e.preventDefault();
        sendMessage();
    }
});

// ================= SEARCH CONTACT =================
document.getElementById("searchContact").addEventListener("input", async function () {
    searchKeyword = this.value;
    await loadContacts(onlineUsersList);
});