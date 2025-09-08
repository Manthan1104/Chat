document.addEventListener('DOMContentLoaded', () => {
    // --- Basic Setup & Element Selectors ---
    const token = localStorage.getItem('chat-token');
    const username = localStorage.getItem('chat-username');
    const userRole = localStorage.getItem('chat-user-role');
    if (!token || !username) {
        window.location.href = '/login.html';
        return;
    }
    const messages = document.getElementById('messages');
    const userList = document.getElementById('user-list');
    const chatHeader = document.getElementById('chat-header');
    const displayUsername = document.getElementById('display-username');
    const modal = document.getElementById('chat-request-modal');
    const requestMessage = document.getElementById('request-message');
    const acceptBtn = document.getElementById('accept-btn');
    const rejectBtn = document.getElementById('reject-btn');
    displayUsername.textContent = username;
    
    // --- State Management ---
    let ws;
    let currentChatRecipient = 'community';
    let pendingRequestFrom = null;

    // --- Helper Functions ---
    function formatTimestamp(timestamp) {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        const options = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
        return date.toLocaleString('en-IN', options);
    }

    // --- WebSocket Logic ---
    function connectWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        ws = new WebSocket(`${protocol}//${window.location.host}`);

        ws.onopen = () => {
            console.log('Connected to WebSocket');
            ws.send(JSON.stringify({ type: 'authenticate', username, role: userRole }));
        };

        ws.onmessage = (event) => {
            const message = JSON.parse(event.data);
            switch (message.type) {
                case 'history':
                case 'chat_history':
                    messages.innerHTML = '';
                    message.data.forEach(displayMessage);
                    break;
                case 'message':
                case 'private_message':
                    const sender = message.data.username || message.data.sender;
                    const recipient = message.data.recipient;
                    if ((currentChatRecipient === 'community' && !recipient) ||
                        (sender === currentChatRecipient && recipient === username) ||
                        (sender === username && recipient === currentChatRecipient)) {
                        displayMessage(message.data);
                    }
                    break;
                case 'online_users':
                    renderUserList(message.data);
                    break;
                case 'incoming_request':
                    pendingRequestFrom = message.from;
                    requestMessage.textContent = `${pendingRequestFrom} wants to chat with you.`;
                    modal.classList.remove('hidden');
                    break;
                case 'response_received':
                    if (message.response === 'accepted') {
                        alert(`${message.from} accepted your chat request!`);
                        openChatWith(message.from);
                    } else {
                        alert(`${message.from} rejected your chat request.`);
                    }
                    break;
            }
        };

        ws.onclose = () => {
            console.log('WebSocket disconnected. Reconnecting...');
            setTimeout(connectWebSocket, 3000);
        };
    }

    // --- UI Rendering ---
    function renderUserList(users) {
        userList.innerHTML = '';
        const communityItem = document.createElement('div');
        communityItem.className = 'p-3 hover:bg-gray-100 cursor-pointer font-semibold text-indigo-600';
        communityItem.textContent = 'Community Chat';
        communityItem.dataset.username = 'community';
        userList.appendChild(communityItem);

        users.forEach(user => {
            if (user.name === username) return;
            const avatarSrc = user.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=e0e7ff&color=4f46e5`;
            const userItem = document.createElement('div');
            userItem.className = 'user-item';
            userItem.dataset.username = user.name;
            userItem.innerHTML = `
                <div class="avatar-container">
                    <img src="${avatarSrc}" alt="${user.name}" class="avatar">
                    <div class="status-dot"></div>
                </div>
                <span class="font-medium">${user.name}</span>`;
            userList.appendChild(userItem);
        });
    }

    function displayMessage(msg) {
        const senderName = msg.username || msg.sender;
        const isOwnMessage = senderName === username;
        const messageElement = document.createElement('div');
        messageElement.id = msg._id;
        messageElement.className = `message flex items-start gap-3 ${isOwnMessage ? 'justify-end' : 'justify-start'}`;
        const formattedTime = formatTimestamp(msg.timestamp);

        messageElement.innerHTML = `
            <div class="flex flex-col ${isOwnMessage ? 'items-end' : 'items-start'} max-w-[80%]">
                ${!isOwnMessage ? `<a href="/profile.html?user=${senderName}" class="font-semibold text-sm text-indigo-800 hover:underline">${senderName}</a>` : ''}
                <div class="min-w-[60px] p-3 rounded-xl ${isOwnMessage ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-800'}">
                    ${msg.image ? `<img src="${msg.image}" class="rounded-lg max-w-xs h-auto mb-2">` : ''}
                    ${msg.text ? `<p class="text-sm break-words">${msg.text}</p>` : ''}
                </div>
                <div class="text-xs text-gray-400 mt-1 px-1">${formattedTime}</div>
            </div>`;
        messages.appendChild(messageElement);
        messages.scrollTop = messages.scrollHeight;
    }

    function openChatWith(username) {
        currentChatRecipient = username;
        chatHeader.textContent = `Chat with ${currentChatRecipient}`;
        messages.innerHTML = `<div class="text-center text-gray-500 p-4">Loading history...</div>`;
        ws.send(JSON.stringify({ type: 'get_history', with: currentChatRecipient }));
    }
    
    // --- Message Sending ---
    function sendMessage(text = null, image = null) {
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        const messageText = text === null ? document.getElementById('message-input').value.trim() : text;
        if (!messageText && !image) return;
        const messagePayload = currentChatRecipient === 'community'
            ? { type: 'message', text: messageText, image }
            : { type: 'private_message', recipient: currentChatRecipient, text: messageText, image };
        ws.send(JSON.stringify(messagePayload));
        document.getElementById('message-input').value = '';
        document.getElementById('image-input').value = '';
    }

    // --- Event Listeners ---
    document.getElementById('message-form').addEventListener('submit', (e) => {
        e.preventDefault();
        sendMessage();
    });

    userList.addEventListener('click', (e) => {
        const clickedUserItem = e.target.closest('.user-item, [data-username="community"]');
        if (clickedUserItem) {
            const selectedUser = clickedUserItem.dataset.username;
            if (selectedUser === currentChatRecipient) return;

            if (selectedUser === 'community') {
                currentChatRecipient = 'community';
                chatHeader.textContent = 'Community Chat';
                ws.send(JSON.stringify({ type: 'get_history', with: 'community' }));
            } else {
                alert(`Sending chat request to ${selectedUser}...`);
                ws.send(JSON.stringify({ type: 'chat_request', to: selectedUser }));
            }
        }
    });

    acceptBtn.addEventListener('click', () => {
        if (pendingRequestFrom) {
            ws.send(JSON.stringify({ type: 'request_response', to: pendingRequestFrom, response: 'accepted' }));
            openChatWith(pendingRequestFrom);
            pendingRequestFrom = null;
            modal.classList.add('hidden');
        }
    });

    rejectBtn.addEventListener('click', () => {
        if (pendingRequestFrom) {
            ws.send(JSON.stringify({ type: 'request_response', to: pendingRequestFrom, response: 'rejected' }));
            pendingRequestFrom = null;
            modal.classList.add('hidden');
        }
    });

    document.getElementById('logout-btn').addEventListener('click', () => {
        localStorage.clear();
        window.location.href = '/login.html';
    });
    
    document.getElementById('image-input').addEventListener('change', (e) => {
        if (e.target.files[0]) {
            const reader = new FileReader();
            reader.onload = (event) => sendMessage(null, event.target.result);
            reader.readAsDataURL(e.target.files[0]);
        }
    });

    connectWebSocket();
});