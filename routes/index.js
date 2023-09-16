import express from 'express'
import { testCohere, testGPT, createImage, prompt } from '../controllers/controller.js';

const rootRouter = express.Router()

export default rootRouter