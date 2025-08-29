document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('chat-token');
    const username = localStorage.getItem('chat-username');
    const userRole = localStorage.getItem('chat-user-role'); // Get user role

    if (!token || !username) {
        window.location.href = '/login.html';
        return;
    }

    const displayUsername = document.getElementById('display-username');
    const logoutBtn = document.getElementById('logout-btn');
    const messages = document.getElementById('messages');
    const messageForm = document.getElementById('message-form');
    const messageInput = document.getElementById('message-input');
    const imageInput = document.getElementById('image-input');

    displayUsername.textContent = username;
    let ws;

    function connectWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        ws = new WebSocket(`${protocol}//${host}`);

        ws.onopen = () => {
            console.log('Connected to WebSocket server');
            // Authenticate with the server, now including the role
            ws.send(JSON.stringify({ type: 'authenticate', username: username, role: userRole }));
        };

        ws.onmessage = (event) => {
            const message = JSON.parse(event.data);
            switch (message.type) {
                case 'history':
                    messages.innerHTML = '';
                    message.data.forEach(msg => displayMessage(msg));
                    break;
                case 'message':
                    displayMessage(message.data);
                    break;
                case 'messageDeleted':
                    const msgElement = document.getElementById(message.id);
                    if (msgElement) msgElement.remove();
                    break;
            }
        };

        ws.onclose = () => setTimeout(connectWebSocket, 3000);
    }

    function sendMessage(text = null, image = null) {
        const messageText = text === null ? messageInput.value.trim() : text;
        if ((messageText || image) && ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'message',
                username: username,
                text: messageText,
                image: image
            }));
            messageInput.value = '';
            imageInput.value = '';
        }
    }

    function deleteMessage(messageId) {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'deleteMessage',
                id: messageId,
                username: username
            }));
        }
    }

    function displayMessage(msg) {
        const isOwnMessage = msg.username === username;
        const isAdmin = userRole === 'admin';
        const messageElement = document.createElement('div');
        messageElement.id = msg._id;
        messageElement.classList.add('message', 'flex', 'items-start', 'gap-3', isOwnMessage ? 'justify-end' : 'justify-start');

        let content = `
            <div class="flex flex-col ${isOwnMessage ? 'items-end' : 'items-start'}">
                ${!isOwnMessage ? `<a href="/profile.html?user=${msg.username}" class="font-semibold text-sm text-indigo-800 hover:underline">${msg.username}</a>` : ''}
                <div class="message-bubble ${isOwnMessage ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-800'}">
                    ${msg.image ? `<img src="${msg.image}" class="rounded-lg max-w-xs h-auto my-2">` : ''}
                    ${msg.text ? `<p class="text-sm">${msg.text}</p>` : ''}
                </div>
            </div>
        `;
        
        // Show delete button if it's your own message OR if you are an admin
        if (isOwnMessage || isAdmin) {
            content += `
                <button class="delete-btn opacity-50 hover:opacity-100" data-id="${msg._id}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
            `;
        }
        
        messageElement.innerHTML = content;
        messages.appendChild(messageElement);
        messages.scrollTop = messages.scrollHeight;

        const deleteBtn = messageElement.querySelector('.delete-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => deleteMessage(deleteBtn.dataset.id));
        }
    }

    messageForm.addEventListener('submit', (e) => {
        e.preventDefault();
        sendMessage();
    });

    logoutBtn.addEventListener('click', () => {
        localStorage.clear();
        window.location.href = '/login.html';
    });
    
    imageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => sendMessage(null, event.target.result);
            reader.readAsDataURL(file);
        }
    });

    connectWebSocket();
});
