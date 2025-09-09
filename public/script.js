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
    const messageInput = document.getElementById('message-input');
    const typingIndicator = document.getElementById('typing-indicator');
    const emojiPicker = document.getElementById('emoji-picker');
    displayUsername.textContent = username;
    
    // --- State Management ---
    let ws;
    let currentChatRecipient = 'community';
    let pendingRequestFrom = null;
    let typingTimeout;
    const typers = new Set();

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
                    message.data.forEach(msg => displayMessage(msg));
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
                case 'messageDeleted':
                    document.getElementById(message.id)?.remove();
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
                case 'typing_start':
                    if (message.from !== username) typers.add(message.from);
                    updateTypingIndicator();
                    break;
                case 'typing_stop':
                    typers.delete(message.from);
                    updateTypingIndicator();
                    break;
                case 'message_updated':
                    const messageElement = document.getElementById(message.data._id);
                    if (messageElement) {
                        displayMessage(message.data, messageElement);
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

    function displayMessage(msg, existingElement = null) {
        const senderName = msg.username || msg.sender;
        const isOwnMessage = senderName === username;
        const isAdmin = userRole === 'admin';
        const messageType = msg.recipient ? 'private' : 'community';
        const formattedTime = formatTimestamp(msg.timestamp);

        const reactionsHTML = (msg.reactions && msg.reactions.length > 0)
            ? `<div class="reactions-container">` + msg.reactions.map(r => `<div class="reaction">${r.emoji} ${r.user}</div>`).join('') + `</div>`
            : '';

        const addReactionButton = `<span class="add-reaction-btn ml-2" data-id="${msg._id}" data-message-type="${messageType}">😊</span>`;

        const messageBubble = `
            <div class="flex flex-col ${isOwnMessage ? 'items-end' : 'items-start'} max-w-[80%]">
                ${!isOwnMessage ? `<a href="/profile.html?user=${senderName}" class="font-semibold text-sm text-indigo-800 hover:underline">${senderName}</a>` : ''}
                <div class="min-w-[60px] p-3 rounded-xl ${isOwnMessage ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-800'}">
                    ${msg.image ? `<img src="${msg.image}" class="rounded-lg max-w-xs h-auto mb-2" alt="Chat image">` : ''}
                    ${msg.text ? `<p class="text-sm break-words">${msg.text}</p>` : ''}
                </div>
                ${reactionsHTML}
                <div class="text-xs text-gray-400 mt-1 px-1 flex items-center">${formattedTime} ${addReactionButton}</div>
            </div>`;
        
        const deleteButton = (isOwnMessage || isAdmin)
            ? `<button class="delete-btn text-gray-400 hover:text-red-500" data-id="${msg._id}" data-message-type="${messageType}">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>`
            : '<div class="w-4"></div>';

        const finalHTML = isOwnMessage ? `${deleteButton}${messageBubble}` : `${messageBubble}${deleteButton}`;
        
        let messageElement = existingElement;
        if (!messageElement) {
            messageElement = document.createElement('div');
            messageElement.id = msg._id;
            messageElement.className = `message flex items-center gap-3 ${isOwnMessage ? 'flex-row-reverse' : ''}`;
            messages.appendChild(messageElement);
        }
        
        messageElement.innerHTML = finalHTML;

        if (!existingElement) { messages.scrollTop = messages.scrollHeight; }

        messageElement.querySelector('.delete-btn')?.addEventListener('click', (e) => {
            const { id, messageType } = e.currentTarget.dataset;
            deleteMessage(id, messageType);
        });

        messageElement.querySelector('.add-reaction-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            const rect = e.currentTarget.getBoundingClientRect();
            emojiPicker.style.left = `${rect.left - 80}px`;
            emojiPicker.style.top = `${rect.top - 50}px`;
            emojiPicker.classList.remove('hidden');
            emojiPicker.dataset.messageId = e.currentTarget.dataset.id;
            emojiPicker.dataset.messageType = e.currentTarget.dataset.messageType;
        });
    }

    function updateTypingIndicator() {
        if (typers.size === 0) {
            typingIndicator.textContent = '';
            return;
        }
        const names = Array.from(typers).join(', ');
        typingIndicator.textContent = `${names} ${typers.size > 1 ? 'are' : 'is'} typing...`;
    }

    function openChatWith(username) {
        currentChatRecipient = username;
        chatHeader.textContent = `Chat with ${currentChatRecipient}`;
        messages.innerHTML = `<div class="text-center text-gray-500 p-4">Loading history...</div>`;
        ws.send(JSON.stringify({ type: 'get_history', with: currentChatRecipient }));
    }
    
    function sendMessage(text = null, image = null) {
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        const messageText = text === null ? messageInput.value.trim() : text;
        if (!messageText && !image) return;
        const messagePayload = currentChatRecipient === 'community'
            ? { type: 'message', text: messageText, image }
            : { type: 'private_message', recipient: currentChatRecipient, text: messageText, image };
        ws.send(JSON.stringify(messagePayload));
        messageInput.value = '';
        ws.send(JSON.stringify({ type: 'typing_stop', to: currentChatRecipient }));
        clearTimeout(typingTimeout);
    }

    function deleteMessage(id, messageType) {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'deleteMessage', id, messageType }));
        }
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

    messageInput.addEventListener('input', () => {
        clearTimeout(typingTimeout);
        ws.send(JSON.stringify({ type: 'typing_start', to: currentChatRecipient }));
        typingTimeout = setTimeout(() => {
            ws.send(JSON.stringify({ type: 'typing_stop', to: currentChatRecipient }));
        }, 2000);
    });

    emojiPicker.addEventListener('click', (e) => {
        e.stopPropagation();
        if (e.target.tagName === 'SPAN') {
            const emoji = e.target.textContent;
            const { messageId, messageType } = emojiPicker.dataset;
            ws.send(JSON.stringify({ type: 'add_reaction', messageId, messageType, emoji }));
            emojiPicker.classList.add('hidden');
        }
    });
    
    // CORRECTED: This function and the following listeners will fix the issue.
    const hidePicker = () => {
        if (!emojiPicker.classList.contains('hidden')) {
            emojiPicker.classList.add('hidden');
        }
    };
    document.addEventListener('click', hidePicker);
    messages.addEventListener('scroll', hidePicker);

    connectWebSocket();
});