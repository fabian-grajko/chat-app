const express = require('express');
const http = require('http');
const socketio = require('socket.io');
const Filter = require('bad-words');
const { generateMessage, generateLocationMessage } = require('./utils/messages');
const { addUser, removeUser, getUser, getUsersInRoom } = require('./utils/users');

const PORT = process.env.PORT || 3000;
const SYSTEM_USERNAME = 'System';

const app = express();
const server = http.createServer(app);
const io = socketio(server);

app.use(express.json());
app.use(express.static('public'));

io.on('connection', (socket) => {
    console.log('New WebSocket connection');

    socket.on('join', (options, callback) => {
        const {error, user} = addUser({
            id: socket.id,
            ...options
        });

        if (error) {
            return callback(error);
        }

        socket.join(user.room);

        socket.emit('message', generateMessage(SYSTEM_USERNAME, 'Welcome!'));
        socket.broadcast.to(user.room).emit('message', generateMessage(SYSTEM_USERNAME, `${user.username} has joined!`));
        io.to(user.room).emit('roomData', {
            room: user.room,
            users: getUsersInRoom(user.room)
        });

        callback();
    });

    socket.on('sendMessage', (message, callback) => {
        const user = getUser(socket.id);
        const filter = new Filter();

        if (!user) {
            return socket.emit('message', generateMessage(SYSTEM_USERNAME, 'Failed to connect to server. Try refreshing the page.'));
        }

        if(filter.isProfane(message)){
            return callback('Profanity is not allowed');
        }

        io.to(user.room).emit('message', generateMessage(user.username, message));
        callback('Delivered!');
    });

    socket.on('sendLocation', (location, callback) => {
        const { longitude, latitude } = location;
        const user = getUser(socket.id);

        if (!user) {
            return socket.emit('message', generateMessage(SYSTEM_USERNAME, 'Failed to connect to server. Try refreshing the page.'));
        }

        io.to(user.room).emit('locationMessage', generateLocationMessage(user.username, latitude, longitude));
        callback();
    });

    socket.on('disconnect', () => {
        const user = removeUser(socket.id);
        if (user) {
            io.to(user.room).emit('message', generateMessage(SYSTEM_USERNAME, `${user.username} has left!`));
            io.to(user.room).emit('roomData', {
                room: user.room,
                users: getUsersInRoom(user.room)
            });
        }
    });
});

server.listen(PORT, () => {
    console.log('App listening on port', PORT);
});