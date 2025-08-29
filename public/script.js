document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('chat-token');
    const username = localStorage.getItem('chat-username');
    const userRole = localStorage.getItem('chat-user-role');

    if (!token || !username) {
        window.location.href = '/login.html';
        return;
    }

    document.getElementById('display-username').textContent = username;
    const messages = document.getElementById('messages');
    let ws;

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
                    messages.innerHTML = '';
                    message.data.forEach(displayMessage);
                    break;
                case 'message':
                    displayMessage(message.data);
                    break;
                case 'messageDeleted':
                    document.getElementById(message.id)?.remove();
                    break;
                case 'chatCleared':
                    messages.innerHTML = '';
                    displaySystemMessage('Chat history has been cleared by an admin.');
                    break;
            }
        };
        ws.onclose = () => setTimeout(connectWebSocket, 3000);
    }

    function displayMessage(msg) {
        const isOwnMessage = msg.username === username;
        const isAdmin = userRole === 'admin';
        const messageElement = document.createElement('div');
        messageElement.id = msg._id;
        messageElement.className = `message flex items-start gap-3 ${isOwnMessage ? 'justify-end' : 'justify-start'}`;

        let content = `
            <div class="flex flex-col ${isOwnMessage ? 'items-end' : 'items-start'}">
                ${!isOwnMessage ? `<a href="/profile.html?user=${msg.username}" class="font-semibold text-sm text-indigo-800 hover:underline">${msg.username}</a>` : ''}
                <div class="min-w-[60px] p-3 rounded-xl ${isOwnMessage ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-800'}">
                    ${msg.image ? `<img src="${msg.image}" class="rounded-lg max-w-xs h-auto mb-2">` : ''}
                    ${msg.text ? `<p class="text-sm break-words">${msg.text}</p>` : ''}
                </div>
            </div>
        `;
        
        if (isOwnMessage || isAdmin) {
            content += `
                <button class="delete-btn mt-6 opacity-50 hover:opacity-100" data-id="${msg._id}">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>`;
        }
        
        messageElement.innerHTML = content;
        messages.appendChild(messageElement);
        messages.scrollTop = messages.scrollHeight;
        messageElement.querySelector('.delete-btn')?.addEventListener('click', (e) => {
            deleteMessage(e.currentTarget.dataset.id);
        });
    }

    function sendMessage(text = null, image = null) {
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        const messageText = text === null ? document.getElementById('message-input').value.trim() : text;
        if (messageText || image) {
            ws.send(JSON.stringify({ type: 'message', text: messageText, image }));
            document.getElementById('message-input').value = '';
            document.getElementById('image-input').value = '';
        }
    }

    function deleteMessage(id) {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'deleteMessage', id }));
        }
    }
    
    function displaySystemMessage(text) {
        const systemMessageElement = document.createElement('div');
        systemMessageElement.className = 'text-center my-2';
        systemMessageElement.innerHTML = `<span class="text-xs text-gray-500 italic px-2 py-1 bg-gray-100 rounded-full">${text}</span>`;
        messages.appendChild(systemMessageElement);
    }

    document.getElementById('message-form').addEventListener('submit', (e) => {
        e.preventDefault();
        sendMessage();
    });

    document.getElementById('logout-btn').addEventListener('click', () => {
        localStorage.clear();
        window.location.href = '/login.html';
    });
    
    document.getElementById('image-input').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => sendMessage(null, event.target.result);
            reader.readAsDataURL(file);
        }
    });

    const clearChatBtn = document.getElementById('clear-chat-btn');
    if (userRole === 'admin') {
        clearChatBtn.classList.remove('hidden');
        clearChatBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to clear the entire chat history? This cannot be undone.')) {
                ws.send(JSON.stringify({ type: 'clearChat' }));
            }
        });
    }

    connectWebSocket();
});
