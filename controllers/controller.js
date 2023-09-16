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

Sample input:
{
"Scene": "A lion is chasing a zebra in a forest."
}

Sample output:
{
"Characters": [
{
“Type": "Lion", 
“Description”: "Yellow, furry, black mane, side view, roaring",
"Actions": [
{
"Position": "10%, 30%",
"Time": "0"
},
{
"Position": "65%, 35%",
"Time": "5",
]
},
{
"Type": "Zebra",
"Description": "Striped black-and-white, scared, side view",
"Actions": [
{
"Position": "40%, 35%",
"Time": "0",
},
{
"Position": "75%, 38%",
"Time": "5",
},
]
},
]
}
\\end
In the above sample output, note how the Lion and the Zebra's x position and y position get CLOSER over time (but not the same(, due to the Lion CHASING the Zebra, but never being specified to catch it within the scene.
Make all positional changes realistic, and factor in the characters' motivations towards each other/other objects.

Your input: 
{
"Scene": "A man chases towards a woman with a knife in his hands."
}`; 

let scenes = 0

async function runConversationGPT(req, res, prompt) {
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
            const imageLink = await generateImage(req, res, element["Type"] + ", " + element["Description"] + ", disney")
            jsonDump["Characters"].push({ "Type": element["Type"], "Actions": element["Actions"], "Size": element["Size"], "Sprite": imageLink })
        }

        // dump json into edem
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
            model: 'command-nightly', 
            max_tokens: 2000,
            truncate: 'END',
            return_likelihoods: 'NONE',
            prompt: msg + prompt + `"\n}`, 
            temperature: 0.6,
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
            const imageLink = await generateImage(req, res, element["Type"] + ", " + element["Description"] + ", disney")
            jsonDump["Characters"].push({ "Type": element["Type"], "Actions": element["Actions"], "Size": element["Size"], "Sprite": imageLink })
        }
        console.log(jsonDump)
    } catch(e) {
console.error(e)
        res.status(500).send(e)
    }
}

async function generateImage(req, res, prompt) {
    try {
        const image = await openai.images.generate({ prompt: prompt }); 
        return image.data[0].url
    } catch(e) {
        res.status(500).send(e)
    }
}

export async function prompt(req, res) {
    const { prompt } = req.body
    await runConversationCohere(req, res, prompt)
    , await runConversationGPT(req, res, prompt)
    , await generateImage(req, res, prompt)
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
