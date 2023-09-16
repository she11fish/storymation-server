import OpenAI from 'openai';
import { config } from "dotenv";
import axios from 'axios';

config()
const openai = new OpenAI({
    apiKey: process.env.OPEN_AI_SECRET_KEY
});

const messages = [{"role": "system", "content": `
        You are a cartoony animation simulator. Given a story prompt, provide a list of sprites that would be required in the animation, and their exact position on the screen in percent. Include the start position as an action.

        Each input will be provided in the following JSON format: 

        {
        "Scene": "{Description of the current scene}"
        }

        Provide your response in the following JSON format, and nothing else: 

        {
        "Background": "{Description of background, visual}",
        "Characters": [
        {
        "Type": "{Type of character}", 
        "Description”: "{Character description, short}",
        "Size": "{Size of character in screen percentage}",
        "Actions": [
        {
        "Position": "{x position in screen percentage from left]%, [y position in screen percentage from top}%",
        "Time": "{time in seconds at which action is taken}"
        },
        {Any other actions taken by the character},
        ]
        },
        {
        "Type": "{Type of character}",
        "Description": "{Character description, visual}",
        "Size": "{Size of character in screen percentage}",
        "Actions": [
        {
        "Position": "{x position in screen percentage from left], [y position in screen percentage from top}",
        "Time": "{time at which action is taken}",
        }
        {Any other actions taken by the character},
        ]
        },
        {Any other characters in the scene}
        ]
        }`}]

async function runConversationGPT(req, res, prompt) {
    try {
        messages.push({"role": "user", "content": prompt})
        const response = await openai.chat.completions.create({
            model: "gpt-4",
            messages: messages,
            temperature: 0.7
        }); 
        res.status(200).send(response.choices[0].message.content)
        return response.choices[0].message.content
    } catch(e) {
        res.status(e.status).send(e)
    }
    
}

async function runConversationCohere(req, res, prompt) {
    const options = {
        method: 'POST',
        url: 'https://api.cohere.ai/v1/generate',
        headers: {
            accept: 'application/json',
            'content-type': 'application/json',
            authorization: process.env.COHERE_SECRET_KEY
        },
        data: {
            max_tokens: 300,
            truncate: 'END',
            return_likelihoods: 'NONE',
            prompt: prompt
        }
    };
      
    try {
        const response = await axios.request(options)
        res.status(200).send(response.data.generations[0].text)
        return response.data.generations[0].text
    } catch(e) {
        res.status(500).send(e)
    }
}

async function generateImage(req, res, prompt) {
    try {
        const image = await openai.images.generate({ prompt: prompt });
        res.status(200).send(image.data[0].url);
        return image.data[0].url
    } catch(e) {
        res.status(500).send(e)
    }
}

export async function prompt(req, res) {
    const { prompt } = req.body
    res.json([await runConversationCohere(req, res, prompt)
    , await runConversationGPT(req, res, prompt)
    , await generateImage(req, res, prompt)])
}

export async function testGPT(req, res) {
    const { prompt } = req.body
    await runConversationGPT(req, res, prompt)
}

export async function testCohere(req, res) {
    const { prompt } = req.body
    await runConversationCohere(req, res, prompt)
}

export async function createImage(req, res) {
    const { prompt } = req.body
    await generateImage(req, res, prompt)
}
