import express from "express";
import cors from 'cors'
import apiRouter from './routes/index.js'
import { config } from "dotenv"
config()

const app = express();
const port = process.env.PORT || 5500

app.use(cors({
    origin: process.env.CLIENT_URL,
    methods: ["GET", "POST", "PATCH", "DELETE"]
}));

app.options('*', cors({
    origin: process.env.CLIENT_URL,
    methods: ["GET", "POST", "PATCH", "DELETE"]
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/v1', apiRouter)

app.get('/')
app.listen(port);
