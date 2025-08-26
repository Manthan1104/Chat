document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('chat-token');
    const username = localStorage.getItem('chat-username');

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

    messageForm.addEventListener('submit', (e) => {
        e.preventDefault();
        sendMessage();
    });

    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('chat-token');
        localStorage.removeItem('chat-username');
        window.location.href = '/login.html';
    });
    
    imageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                sendMessage(null, event.target.result); // Send image as base64 string
            };
            reader.readAsDataURL(file);
        }
    });

    function connectWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        ws = new WebSocket(`${protocol}//${host}`);

        ws.onopen = () => {
            const joinMsg = { type: 'system', text: `${username} has joined the chat.` };
            ws.send(JSON.stringify(joinMsg));
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            switch (data.type) {
                case 'history':
                    messages.innerHTML = '';
                    data.data.forEach(msg => displayMessage(msg.username, msg.text, msg.image, msg.username === username));
                    displaySystemMessage('Welcome to the chat!');
                    break;
                case 'message':
                    displayMessage(data.username, data.text, data.image, false);
                    break;
                case 'system':
                    displaySystemMessage(data.text);
                    break;
            }
        };

        ws.onclose = () => {
            displaySystemMessage('Connection lost. Reconnecting...');
            setTimeout(connectWebSocket, 3000);
        };
    }

    function sendMessage(text = null, image = null) {
        const messageText = text === null ? messageInput.value.trim() : text;
        if ((messageText || image) && ws && ws.readyState === WebSocket.OPEN) {
            const message = {
                type: 'message',
                username: username,
                text: messageText,
                image: image
            };
            ws.send(JSON.stringify(message));
            if (!image) { // Only display our own text messages immediately
                 displayMessage(username, messageText, null, true);
            }
            messageInput.value = '';
            imageInput.value = ''; // Reset file input
        }
    }

    function displayMessage(msgUsername, text, image, isOwnMessage) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', 'max-w-xs', 'md:max-w-md', 'p-3', 'rounded-xl', 'w-fit');
        
        let content = '';
        if (image) {
            content += `<img src="${image}" class="rounded-lg max-w-full h-auto my-2">`;
        }
        if (text) {
            content += `<p class="text-sm">${text}</p>`;
        }

        if (isOwnMessage) {
            messageElement.classList.add('bg-indigo-600', 'text-white', 'self-end', 'ml-auto');
            messageElement.innerHTML = content;
        } else {
            messageElement.classList.add('bg-gray-200', 'text-gray-800', 'self-start');
            messageElement.innerHTML = `<p class="font-semibold text-sm text-indigo-800">${msgUsername}</p>${content}`;
        }
        messages.appendChild(messageElement);
        messages.scrollTop = messages.scrollHeight;
    }

    function displaySystemMessage(text) {
        const systemMessageElement = document.createElement('div');
        systemMessageElement.classList.add('text-center', 'my-2');
        systemMessageElement.innerHTML = `<span class="text-xs text-gray-500 italic px-2 py-1 bg-gray-100 rounded-full">${text}</span>`;
        messages.appendChild(systemMessageElement);
        messages.scrollTop = messages.scrollHeight;
    }

    connectWebSocket();
});
