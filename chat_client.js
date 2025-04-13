document.addEventListener('DOMContentLoaded', () => {
    // --- Configuration & DOM Elements ---
    const socket = io(); // Connect to the server automatically

    const chatBox = document.getElementById('chat-box');
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');
    const partnerNameEl = document.getElementById('partner-name');
    const pageTitle = document.querySelector('title');

    let currentUserType = null; // 'lawyer' or 'client'
    let partnerType = null;
    let partnerDisplayName = "Partner"; // Default name

    // --- Determine User Type from URL ---
    const urlParams = new URLSearchParams(window.location.search);
    const userParam = urlParams.get('user')?.toLowerCase();

    if (userParam === 'lawyer') {
        currentUserType = 'lawyer';
        partnerType = 'client';
        partnerDisplayName = "Client"; // Default name for the other party
        pageTitle.textContent = "Lawyer Chat - LegalAssist";
    } else if (userParam === 'client') {
        currentUserType = 'client';
        partnerType = 'lawyer';
        partnerDisplayName = "Lawyer"; // Default name for the other party
        pageTitle.textContent = "Client Chat - LegalAssist";
    } else {
        // Handle invalid user type - maybe redirect or show error
        addSystemMessage("Error: Invalid user type specified in URL. Please use ?user=lawyer or ?user=client");
        console.error("Invalid user type in URL");
        return; // Stop execution if user type is invalid
    }

    partnerNameEl.textContent = `Chat with ${partnerDisplayName}`; // Initial partner name
    messageInput.placeholder = `Type your message to the ${partnerDisplayName}...`;


    // --- Utility Functions ---
    function scrollToBottom() {
        setTimeout(() => { chatBox.scrollTop = chatBox.scrollHeight; }, 50); // Slight delay for render
    }

    function addMessageToBox(messageData) {
        const { text, sender, timestamp } = messageData;
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message');

        if (sender === currentUserType) {
            messageDiv.classList.add('this-user');
        } else {
            messageDiv.classList.add('other-user');
        }

        // Format timestamp nicely
        const time = new Date(timestamp || Date.now()).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });
        const timeSpan = `<span class="message-time">${time}</span>`;

        // Basic text escaping (replace with a more robust library in production)
        const escapedText = text.replace(/</g, "<").replace(/>/g, ">");

        messageDiv.innerHTML = escapedText + timeSpan;
        chatBox.appendChild(messageDiv);
        scrollToBottom();
    }

    function addSystemMessage(text) {
        const messageDiv = document.createElement('div');
        // Add a specific class for styling system messages if needed in chat_styles.css
        messageDiv.classList.add('system-message', 'text-center', 'text-secondary', 'py-2', 'fst-italic', 'small');
        messageDiv.textContent = text;
        chatBox.appendChild(messageDiv);
        scrollToBottom();
    }

    function enableChatInput() {
        messageInput.disabled = false;
        sendButton.disabled = false;
        messageInput.focus();
    }

    // --- Sending Messages ---
    function sendMessage() {
        const messageText = messageInput.value.trim();
        if (!messageText) return;

        const messageData = {
            text: messageText,
            sender: currentUserType,
            timestamp: new Date().toISOString()
        };

        socket.emit('chat message', messageData); // Send to server
        // We *don't* add it directly here anymore. We wait for the server
        // to broadcast it back to everyone (including us) via socket.on('chat message')
        // This ensures everyone sees messages in the same order.

        messageInput.value = ''; // Clear input
    }

    // --- Event Listeners ---
    sendButton.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Dummy logout
    document.getElementById('logout-button').addEventListener('click', () => {
        alert('Simulating logout. Connection will be lost.');
        socket.disconnect();
        // window.location.href = '/'; // Or login page
    });


    // --- Socket.IO Event Handlers ---
    socket.on('connect', () => {
        console.log('Connected to server with ID:', socket.id);
        addSystemMessage('Connected to chat server.');
        // Tell the server who we are
        socket.emit('user joined', { userType: currentUserType });
        enableChatInput();
    });

    socket.on('disconnect', (reason) => {
        console.log('Disconnected from server:', reason);
        addSystemMessage(`Disconnected: ${reason}. Please refresh to reconnect.`);
        messageInput.disabled = true;
        sendButton.disabled = true;
    });

    socket.on('connect_error', (err) => {
        console.error('Connection error:', err);
        addSystemMessage(`Connection failed: ${err.message}. Retrying...`);
    });

    socket.on('chat message', (messageData) => {
        console.log('Message received:', messageData);
        addMessageToBox(messageData);
    });

    socket.on('system message', (message) => {
        console.log('System Message:', message);
        addSystemMessage(message);
        // Potentially update partner name if message indicates partner joined/left
        if (message.includes("joined") && message.includes(partnerType)) {
             partnerNameEl.textContent = `Chat with ${partnerDisplayName}`;
        } else if (message.includes("left") && message.includes(partnerType)) {
             partnerNameEl.textContent = `${partnerDisplayName} (Offline)`;
        }
    });

    socket.on('chat history', (history) => {
        console.log('Received chat history:', history);
         // Clear placeholder messages before loading history
        const placeholder = chatBox.querySelector('.system-message');
        if (placeholder && placeholder.textContent.includes('Welcome')) {
            chatBox.innerHTML = '';
        }
        history.forEach(msg => addMessageToBox(msg));
         addSystemMessage("Chat history loaded.");
    });

}); // End DOMContentLoaded