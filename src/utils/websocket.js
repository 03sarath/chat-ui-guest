export class WebSocketClient {
  constructor(url, sessionId) {
    this.url = url;
    this.sessionId = sessionId;
    this.socket = null;
    this.messageHandlers = [];
    this.connectionHandlers = [];
    this.errorHandlers = [];
  }

  connect() {
    try {
      this.socket = new WebSocket(this.url);
      console.log('Attempting to connect to:', this.url);

      this.socket.onopen = () => {
        console.log('WebSocket connection established');
        this.connectionHandlers.forEach(handler => handler(true));
      };

      this.socket.onmessage = (event) => {
        console.log('Raw message received:', event.data);
        try {
          const message = JSON.parse(event.data);
          console.log('Parsed message:', message);

          // Check for different message structures
          if (message.chat_history) {
            console.log('Received chat history:', message.chat_history);
            this.connectionHandlers.forEach(handler => handler(true, message.chat_history));
          } else if (message.from) {
            // Handle regular chat messages
            console.log('Received chat message:', message);
            this.messageHandlers.forEach(handler => handler(message));
          } else {
            // Handle other message types
            console.log('Received other message type:', message);
            this.messageHandlers.forEach(handler => handler(message));
          }
        } catch (error) {
          console.error('Error parsing message:', error);
          console.log('Raw message that failed to parse:', event.data);
          this.messageHandlers.forEach(handler => handler(event.data));
        }
      };

      this.socket.onclose = (event) => {
        console.log('WebSocket connection closed:', event.code, event.reason);
        this.connectionHandlers.forEach(handler => handler(false));
      };

      this.socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.errorHandlers.forEach(handler => handler(error));
      };
    } catch (error) {
      console.error('Error creating WebSocket:', error);
      this.errorHandlers.forEach(handler => handler(error));
    }
  }

  sendMessage(to, message) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      const payload = {
        action: 'sendMessage',
        to: to,
        message: message,
        session_id: this.sessionId
      };
      console.log('Sending message payload:', payload);
      this.socket.send(JSON.stringify(payload));
    } else {
      console.error('Cannot send message: WebSocket is not open. Current state:', this.socket ? this.socket.readyState : 'no socket');
    }
  }

  addMessageHandler(handler) {
    this.messageHandlers.push(handler);
  }

  addConnectionHandler(handler) {
    this.connectionHandlers.push(handler);
  }

  addErrorHandler(handler) {
    this.errorHandlers.push(handler);
  }

  disconnect() {
    if (this.socket) {
      console.log('Disconnecting WebSocket');
      this.socket.close();
    }
  }
} 