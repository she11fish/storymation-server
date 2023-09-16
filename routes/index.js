import express from 'express'
import { testCohere, testGPT, createImage, prompt } from '../controllers/controller.js';

const rootRouter = express.Router()

rootRouter.post('/prompt', prompt)
rootRouter.post('/testGPT', testGPT)
rootRouter.post('/testCohere', testCohere);
rootRouter.post('/createImage', createImage)

export default rootRouter