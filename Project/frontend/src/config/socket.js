import socket from 'socket.io-client';

let socketInstance = null;

export const initializeSocket = (projectId) => {
  if (socketInstance) {
    socketInstance.disconnect();
  }

  socketInstance = socket(import.meta.env.VITE_API_URL, {
    auth: {
      token: localStorage.getItem('token')
    },
    query: {
      projectId
    }
  });

  socketInstance.on('connect', () => {
    console.log('✅ Socket connected:', socketInstance.id);
  });

  socketInstance.on('disconnect', () => {
    console.log('❌ Socket disconnected');
  });

  socketInstance.on('connect_error', (error) => {
    console.error('🚨 Socket connection error:', error);
  });

  return socketInstance;
};

export const receiveMessage = (eventName, cb) => {
  if (socketInstance) {
    socketInstance.on(eventName, cb);
  }
};

export const sendMessage = (eventName, data) => {
  if (socketInstance) {
    socketInstance.emit(eventName, data);
  }
};
