<template>
  <div class="guest-page">
    <div class="chat-container">
      <!-- Header -->
      <div class="chat-header">
        <div class="header-content">
          <h1 class="title is-4">Guest Chat</h1>
          <span class="connection-status" :class="{ 'is-connected': isConnected }">
            {{ isConnected ? 'Connected' : 'Disconnected' }}
          </span>
        </div>
      </div>

      <!-- Chat Window -->
      <div class="chat-window">
        <div class="messages-container" ref="chatLog">
          <div
            v-for="(message, index) in messages"
            :key="index"
            class="message"
            :class="{
              'message-guest': message.isGuest,
              'message-host': !message.isGuest,
              'is-editing': message.isEditing
            }"
          >
            <div class="message-content">
              <div v-if="message.isEditing" class="edit-container">
                <input
                  v-model="message.editText"
                  type="text"
                  class="edit-input"
                  @keyup.enter="saveEdit(message)"
                  @keyup.esc="cancelEdit(message)"
                  ref="editInput"
                />
                <div class="edit-actions">
                  <button class="edit-button save" @click="saveEdit(message)">
                    <i class="fas fa-check"></i>
                  </button>
                  <button class="edit-button cancel" @click="cancelEdit(message)">
                    <i class="fas fa-times"></i>
                  </button>
                </div>
              </div>
              <template v-else>
                <p class="message-text">{{ message.text }}</p>
                <small class="message-time">{{ message.timestamp }}</small>
                <div v-if="message.isGuest" class="message-actions">
                  <button class="action-button edit" @click="startEdit(message)">
                    <i class="fas fa-edit"></i>
                  </button>
                  <button class="action-button delete" @click="deleteMessage(message)">
                    <i class="fas fa-trash"></i>
                  </button>
                </div>
              </template>
            </div>
          </div>
        </div>

        <!-- Message Input -->
        <div class="message-input">
          <div class="input-container">
            <input
              v-model="newMessage"
              type="text"
              placeholder="Type your message..."
              @keyup.enter="sendMessage"
              class="message-input-field"
              :disabled="!isConnected"
            />
            <button
              @click="sendMessage"
              class="send-button"
              :disabled="!isConnected || !newMessage.trim()"
            >
              <i class="fas fa-paper-plane"></i>
              <span class="send-text">Send</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { WebSocketClient } from '../utils/websocket';

export default {
  name: 'GuestPage',
  data() {
    return {
      guestEmail: 'test@gmail.com',
      hostEmail: 'host@gmail.com',
      sessionId: 'session_test',
      eventId: 'event_2',
      messages: [],
      newMessage: '',
      isConnected: false,
      wsClient: null,
      reconnectAttempts: 0,
      maxReconnectAttempts: 5
    };
  },
  created() {
    this.initializeWebSocket();
  },
  beforeDestroy() {
    if (this.wsClient) {
      this.wsClient.disconnect();
    }
  },
  methods: {
    initializeWebSocket() {
      const wsUrl = `wss://0ug96h4n9g.execute-api.us-east-1.amazonaws.com/production?guest_id=${this.guestEmail}&session_id=${this.sessionId}&event_id=${this.eventId}`;
      this.wsClient = new WebSocketClient(wsUrl, this.sessionId);
      
      this.wsClient.addMessageHandler(this.handleIncomingMessage);
      this.wsClient.addConnectionHandler(this.handleConnectionChange);
      this.wsClient.addErrorHandler(this.handleError);
      
      this.wsClient.connect();
      
      // Set initial connection status
      this.isConnected = this.wsClient.socket && this.wsClient.socket.readyState === WebSocket.OPEN;
    },
    handleIncomingMessage(message) {
      console.log('Handling incoming message:', message);
      try {
        // Handle regular messages
        const parsedMessage = typeof message === 'string' ? JSON.parse(message) : message;
        console.log('Parsed message for display:', parsedMessage);
        
        this.messages.push({
          text: parsedMessage.message || parsedMessage.Message || '[No message]',
          isGuest: parsedMessage.from === this.guestEmail,
          timestamp: new Date(parsedMessage.timestamp || parsedMessage.Timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isEditing: false,
          editText: ''
        });
        
        this.scrollToBottom();
      } catch (error) {
        console.error('Error handling message:', error);
        console.log('Raw message that caused error:', message);
        // Fallback for non-JSON messages
        this.messages.push({
          text: message,
          isGuest: false,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isEditing: false,
          editText: ''
        });
        this.scrollToBottom();
      }
    },
    handleConnectionChange(isConnected) {
      console.log('Connection status changed:', isConnected);
      this.isConnected = isConnected;
      
      if (!isConnected && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        console.log(`Connection lost. Reconnecting... Attempt ${this.reconnectAttempts}`);
        setTimeout(() => {
          this.initializeWebSocket();
        }, 3000);
      }
    },
    handleError(error) {
      console.error('WebSocket error:', error);
      this.isConnected = false;
      
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        console.log(`Error occurred. Reconnecting... Attempt ${this.reconnectAttempts}`);
        setTimeout(() => {
          this.initializeWebSocket();
        }, 3000);
      }
    },
    sendMessage() {
      if (!this.newMessage.trim() || !this.isConnected) return;
      
      this.wsClient.sendMessage(this.hostEmail, this.newMessage);
      
      this.messages.push({
        text: this.newMessage,
        isGuest: true,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isEditing: false,
        editText: ''
      });
      
      this.newMessage = '';
      this.scrollToBottom();
    },
    scrollToBottom() {
      this.$nextTick(() => {
        const chatLog = this.$refs.chatLog;
        if (chatLog) {
          chatLog.scrollTop = chatLog.scrollHeight;
        }
      });
    },
    startEdit(message) {
      if (!message.isGuest) return;
      message.isEditing = true;
      message.editText = message.text;
      this.$nextTick(() => {
        const input = this.$refs.editInput[this.messages.indexOf(message)];
        if (input) input.focus();
      });
    },
    saveEdit(message) {
      if (!message.isGuest) return;
      const newText = message.editText.trim();
      if (newText && newText !== message.text) {
        message.text = newText;
        // Here you would typically send an update to the server
        // this.wsClient.updateMessage(message.id, newText);
      }
      message.isEditing = false;
      message.editText = '';
    },
    cancelEdit(message) {
      if (!message.isGuest) return;
      message.isEditing = false;
      message.editText = '';
    },
    deleteMessage(message) {
      if (!message.isGuest) return;
      const index = this.messages.indexOf(message);
      if (index !== -1) {
        this.messages.splice(index, 1);
        // Here you would typically send a delete request to the server
        // this.wsClient.deleteMessage(message.id);
      }
    }
  }
};
</script>

<style scoped>
/* Update these styles at the beginning of the style section */
* {
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
}

input, textarea {
  user-select: text !important;
  -webkit-user-select: text !important;
  -moz-user-select: text !important;
  -ms-user-select: text !important;
}

.guest-page {
  cursor: default;
  user-select: none;
}

.chat-container {
  cursor: default;
  user-select: none;
}

.chat-header {
  cursor: default;
  user-select: none;
}

.messages-container {
  flex: 1;
  padding: 1.5rem;
  overflow-y: auto;
  background-color: #f8fafc;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-height: calc(100% - 80px); /* Account for input area */
}

.message {
  margin-bottom: 0.5rem;
  max-width: 70%;
  display: flex;
  flex-direction: column;
  animation: fadeIn 0.3s ease-in-out;
}

/* Incoming messages (from host) */
.message-host {
  align-self: flex-start;
  margin-right: auto;
  width: fit-content;
}

.message-host .message-content {
  background-color: #f0f9ff;  /* Light blue background */
  border-color: #bae6fd;      /* Light blue border */
  color: #0369a1;             /* Dark blue text */
  border-radius: 16px 16px 16px 4px;
}

.message-host .message-text {
  color: #0369a1;             /* Dark blue text */
}

.message-host .message-time {
  color: #0284c7;             /* Medium blue timestamp */
}

/* Outgoing messages (from guest) */
.message-guest {
  align-self: flex-end;
  margin-left: auto;
  width: fit-content;
}

.message-guest .message-content {
  background-color: #f1f5f9;  /* Light gray background */
  border-color: #e2e8f0;      /* Light gray border */
  color: #334155;             /* Dark gray text */
  border-radius: 16px 16px 4px 16px;
}

.message-guest .message-text {
  color: #334155;
}

.message-guest .message-time {
  color: #64748b;
}

.message-content {
  position: relative;
  padding: 0.75rem 1rem;
  border-radius: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.message-actions,
.edit-actions,
.input-container {
  cursor: default;
  user-select: none;
}

/* Remove cursor from non-interactive elements */
.input-container:not(:focus-within) {
  cursor: default;
  user-select: none;
}

/* Only show cursor in the actual input field */
.message-input-field:focus,
.edit-input:focus {
  cursor: text !important;
  user-select: text !important;
}

/* Remove cursor from the entire input container when not focused */
.input-container:not(:focus-within) .message-input-field {
  cursor: default;
  user-select: none;
}

/* Make sure input fields are always selectable */
.message-input-field,
.edit-input {
  cursor: text !important;
  user-select: text !important;
}

.guest-page {
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 1rem;
  background-color: #f0f2f5;
}

.chat-container {
  width: 800px;
  height: 600px;
  display: flex;
  flex-direction: column;
  background-color: white;
  border-radius: 16px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.chat-header {
  padding: 1.5rem;
  background-color: #ffffff;
  border-bottom: 1px solid #eef2f7;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.connection-status {
  font-size: 0.9rem;
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  background-color: #f1f5f9;
  color: #64748b;
}

.connection-status.is-connected {
  background-color: #e3f2fd;
  color: #2d4f6b;
}

.chat-window {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

.message-input {
  position: sticky;
  bottom: 0;
  background-color: #ffffff;
  padding: 1rem;
  border-top: 1px solid #eef2f7;
  z-index: 1;
}

.input-container {
  display: flex;
  align-items: center;
  background-color: #ffffff;
  border: 1px solid #eef2f7;
  border-radius: 24px;
  padding: 0.5rem 0.5rem 0.5rem 1rem;
  transition: all 0.3s ease;
  gap: 0.5rem;
  pointer-events: auto !important;
}

.input-container:focus-within {
  border-color: #2d4f6b;
  box-shadow: 0 0 0 3px rgba(7, 81, 141, 0.1);
}

.message-input-field {
  flex: 1;
  border: none;
  outline: none;
  background: none;
  padding: 0.5rem 1rem;
  font-size: 0.95rem;
  color: #334155;
  cursor: text !important;
  user-select: text !important;
  pointer-events: auto !important;
}

.message-input-field::placeholder {
  color: #94a3b8;
}

.message-input-field:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.send-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  min-width: 90px;
  height: 40px;
  border-radius: 20px;
  border: none;
  background-color: #e3f2fd;
  color: #2d4f6b;
  cursor: pointer;
  transition: all 0.3s ease;
  padding: 0 1rem;
}

.send-button:hover:not(:disabled) {
  background-color: #2d4f6b;
  color: #ffffff;
  transform: scale(1.02);
}

.send-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.send-button i {
  font-size: 0.9rem;
}

.send-text {
  font-size: 0.95rem;
  font-weight: 500;
}

/* Custom scrollbar */
.messages-container::-webkit-scrollbar {
  width: 8px;
}

.messages-container::-webkit-scrollbar-track {
  background: #f1f5f9;
  border-radius: 4px;
}

.messages-container::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 4px;
}

.messages-container::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

/* Ensure messages are properly spaced */
.message + .message {
  margin-top: 0.5rem;
}

/* Add some padding to the first and last messages */
.messages-container {
  padding-top: 1rem;
  padding-bottom: 1rem;
}

.message-actions {
  position: absolute;
  right: 0.5rem;
  top: 0.5rem;
  display: flex;
  gap: 0.25rem;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.message:hover .message-actions {
  opacity: 1;
}

.action-button {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: none;
  background: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #64748b;
  transition: all 0.2s ease;
}

.action-button:hover {
  background-color: rgba(0, 0, 0, 0.05);
  color: #2d4f6b;
}

.action-button.delete:hover {
  color: #dc2626;
}

.edit-container {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.edit-input {
  flex: 1;
  border: 1px solid #eef2f7;
  border-radius: 8px;
  padding: 0.5rem;
  font-size: 0.95rem;
  outline: none;
  transition: all 0.2s ease;
  cursor: text;
}

.edit-input:focus {
  border-color: #2d4f6b;
  box-shadow: 0 0 0 2px rgba(45, 79, 107, 0.1);
}

.edit-actions {
  display: flex;
  gap: 0.25rem;
}

.edit-button {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.edit-button.save {
  background-color: #e3f2fd;
  color: #2d4f6b;
}

.edit-button.cancel {
  background-color: #f1f5f9;
  color: #64748b;
}

.edit-button:hover {
  transform: scale(1.1);
}

.edit-button.save:hover {
  background-color: #2d4f6b;
  color: white;
}

.edit-button.cancel:hover {
  background-color: #e2e8f0;
  color: #475569;
}

.is-editing .message-content {
  background-color: #f8fafc;
  border-color: #e2e8f0;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.message-text {
  line-height: 1.4;
  margin: 0;
  word-break: break-word;
  font-size: 0.95rem;
}

.message-time {
  display: block;
  font-size: 0.75rem;
  margin-top: 0.25rem;
  opacity: 0.7;
}
</style> 