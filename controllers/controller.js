import OpenAI from 'openai';
import { config } from "dotenv";
import axios from 'axios';
import {WebSocketServer} from "ws";

const wss = new WebSocketServer({ port: 5500 })

wss.on('connection', function connection(ws) {
    ws.on('error', console.error);
  
    ws.on('message', function message(data) {
        let stringData = data.toString()
        prompt(stringData, ws)
    });
});

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

const msg = `You are a cartoony animation simulator. Given a story prompt, provide a list of sprites that would be required in the animation, and their exact position on the screen in percent. Include the start position as an action.

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
}
\\end

NOTE: The position of the characters is interpolated between each action. Only add "actions" when that interpolation needs to be changed.

Your input: 
{
"Scene": "`; 

let scenes = 0

async function runConversationGPT(data, ws, prompt) {
    try {
        messages.push({"role": "user", "content": prompt})
        const response = await openai.chat.completions.create({
            model: "gpt-4",
            messages: messages,
            temperature: 0.7
        }); 

        var content = JSON.parse(response.choices[0].message.content); 
        var jsonDump = {}; 
        jsonDump["Characters"] = []; 
        for (const element of content["Characters"]) {
            const imageLink = await generateImage(data, ws, element["Type"] + ", " + element["Description"] + ", cartoony")
            jsonDump["Characters"].push({ "Type": element["Type"], "Actions": element["Actions"], "Size": element["Size"], "Sprite": imageLink })
        }


        // dump json into edem
    } catch(e) {
        ws.send(e)
    }
    
}

async function runConversationCohere(data, ws, prompt) {
    const options = {
        method: 'POST',
        url: 'https://api.cohere.ai/v1/generate',
        headers: {
            accept: 'application/json',
            'content-type': 'application/json',
            authorization: process.env.COHERE_SECRET_KEY
        },
        data: {
            model: 'command-nightly', 
            max_tokens: 2000,
            truncate: 'END',
            return_likelihoods: 'NONE',
            prompt: msg + prompt + `"\n}`, 
            temperature: 0.3,
            stopSequences: ["\\end"],
        }
    }
    try {
        const response = await axios.request(options)
        console.log(response.data.generations[0].text)
        // scenes = JSON.parse(response.data.generations[0].text)["Scenes"].length
        var content = JSON.parse(response.data.generations[0].text); 
        var jsonDump = {}; 
        jsonDump["Characters"] = []; 
        for (const element of content["Characters"]) {
            const imageLink = await generateImage(data, ws, element["Type"] + ", " + element["Description"] + ", cartoony")
            jsonDump["Characters"].push({ "Type": element["Type"], "Actions": element["Actions"], "Size": element["Size"], "Sprite": imageLink })
        }
        console.log(jsonDump)
    } catch(e) {
        console.error(e)
        ws.send(e)
    }
}

async function generateImage(data, ws, prompt) {
    try {
        const image = await openai.images.generate({ prompt: prompt }); 
        return image.data[0].url
    } catch(e) {
        ws.send(e)
    }
}

export async function prompt(data, ws) {
    const prompt = data
    console.log(data)
    console.log(prompt)
    await runConversationCohere(data, ws, prompt)
    //, await runConversationGPT(data, ws, prompt)
    , await generateImage(data, ws, prompt)
}

export async function testGPT(data, ws) {
    const prompt = data
    await runConversationGPT(data, ws, prompt)
}

export async function testCohere(data, ws) {
    const prompt = data
    await runConversationCohere(data, ws, prompt)
}

export async function createImage(data, ws) {
    const prompt = data
    await generateImage(data, ws, prompt)
}
