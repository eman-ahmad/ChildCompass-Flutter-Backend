const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const childRoutes = require('./routes/childRoutes');
const parentRoutes = require('./routes/parentRoutes');
const messageRoutes = require('./routes/messaging');
const cors = require('cors');
const http = require('http');
const locationWebSocket = require('./websockets/locationSharing');
const activeStatusWebSocket = require('./websockets/activeStatus');
const sosWebSocket = require('./websockets/sos');
const taskRoutes = require('./routes/taskRoutes'); 
// In your index.js
const WebSocket = require('ws');

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

// MongoDB Connection
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB Connected');
    } catch (err) {
        console.error(err.message);
        process.exit(1);
    }
};
connectDB();

app.use('/api/child', childRoutes);
app.use('/api/parent', parentRoutes);
app.use('/api/task', taskRoutes);
app.use('/api/message', messageRoutes);


// Test Route
app.get('/', (req, res) => {
    res.send('Child Compass API is running');
});

// Create HTTP server from Express app
const server = http.createServer(app);



// Create separate WebSocket servers with noServer
const locationWSS = new WebSocket.Server({ noServer: true });
const activeStatusWSS = new WebSocket.Server({ noServer: true });
const sosWSS = new WebSocket.Server({ noServer: true });

// Then pass these to your functions
locationWebSocket(locationWSS);
activeStatusWebSocket(activeStatusWSS);
sosWebSocket(sosWSS);

// Handle upgrade requests
server.on('upgrade', (request, socket, head) => {
  const pathname = request.url;
  
  if (pathname === '/location') {
    locationWSS.handleUpgrade(request, socket, head, (ws) => {
      locationWSS.emit('connection', ws, request);
    });
  } else if (pathname === '/activeStatus') {
    activeStatusWSS.handleUpgrade(request, socket, head, (ws) => {
      activeStatusWSS.emit('connection', ws, request);
    });
  } 
  else if (pathname === '/sos') {
    sosWSS.handleUpgrade(request, socket, head, (ws) => {
      sosWSS.emit('connection', ws, request);
    });
  }
  else {
    socket.destroy();
  }
});
// Start HTTP server
const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => console.log(`Server is running on port ${PORT}`));


