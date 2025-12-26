"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const cors_1 = __importDefault(require("cors"));
const socket_io_1 = require("socket.io");
const Matchmaker_1 = require("./Matchmaker");
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
const PORT = parseInt(process.env.PORT || '3000', 10);
app.use((0, cors_1.default)());
app.use(express_1.default.json());
const io = new socket_io_1.Server(server, {
    cors: {
        origin: '*', // Allow all origins for dev
        methods: ['GET', 'POST']
    }
});
const matchmaker = new Matchmaker_1.Matchmaker(io);
io.on('connection', (socket) => {
    matchmaker.handleConnection(socket);
});
app.get('/', (req, res) => {
    res.send('Server is running....');
});
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on http://0.0.0.0:${PORT}`);
});
