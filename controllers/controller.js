import OpenAI from 'openai';
import { config } from "dotenv";
import axios from 'axios';
import { WebSocketServer } from "ws";
import { google } from "googleapis"
import youtubedl from "youtube-dl-exec"
import fs from "fs"
import { rembg } from '@remove-background-ai/rembg.js'; 
import client from "https";

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
        You are a cartoony animation simulator. Given a story prompt, provide a list of sprites that would be required in the animation, and their exact position on the screen in percent. Include the start position as an action, and make scenes be between 1 - 5 seconds long.

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
        "Size": "{Size of character in screen percentage}%",
        "Actions": [
        {
        "Position": "{x position in screen percentage from left]%, [y position in screen percentage from top}%",
        "Time": "{time in seconds at which action is taken}"
        },
        {Any other actions taken by the character while following the same format as "Actions"},
        ]
        },
        {
        "Type": "{Type of character}",
        "Description": "{Character description, visual}",
        "Size": "{Size of character in screen percentage}%",
        "Actions": [
        {
        "Position": "{x position in screen percentage from left]%, [y position in screen percentage from top}%",
        "Time": "{time at which action is taken}",
        }
        {Any other actions taken by the character while following the same format as "Actions"},
        ]
        },
        {Any other characters in the scene while following the same format as "Characters"}
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
"Position": "{x position in screen percentage from left]%, [y position in screen percentage from top}%",
"Time": "{time at which action is taken}",
}
{Any other actions taken by the character while following the same format above},
]
},
{Any other characters in the scene while following the same format above}
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
"Time": "0 seconds"
},
{
"Position": "65%, 35%",
"Time": "5 seconds",
]
},
{
"Type": "Zebra",
"Description": "Striped black-and-white, scared, side view",
"Actions": [
{
"Position": "40%, 35%",
"Time": "0 seconds",
},
{
"Position": "75%, 38%",
"Time": "5 seconds",
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

const initSceneMsg = `You will be provided a story as input. Break down the story into individual scenes as output, formatted in the following strict JSON structure:

{
"Scenes": ["{part of scene 1 with full context}", "{part of scene 2 with full context}", "{part of scene 3 with full context}", etc.]
}
\\end

DO NOT generate too much additional plot. Simply separate the given plot into different scenes. 

Your input:
"`; 

let scenes = 0

async function runConversationGPT(data, ws, prompt) {
    try {
        messages.push({"role": "user", "content": prompt})
        const response = await openai.chat.completions.create({
            model: "gpt-4",
            messages: messages,
            temperature: 0.6
        }); 

        var content = JSON.parse(response.choices[0].message.content); 

        var jsonDump = {
            type: "story"
        }; 
        jsonDump["Characters"] = []; 
        let max = 0;
        for (const element of content["Characters"]) {
            
            const imageLink = await generateImage(data, ws, element["Type"] + ", " + element["Description"] + ", cartoony", false)
            
            jsonDump["Characters"].push({ "Type": element["Type"], "Actions": element["Actions"], "Size": element["Size"], "Sprite": imageLink })
            
            for (const action of element["Actions"]){
                let time = action["Time"].split(" ")[0]
                if (time > max) max = time;
            }

            console.log(element); 
        }
        jsonDump["length"] = max
        const backgroundImageLink = await generateImage(data, ws, "Background, " + content["Background"] + ", cartoony", true)
        jsonDump["Background"] = backgroundImageLink

        ws.send(JSON.stringify(jsonDump)) //send to frontend
        
    } catch(e) {
        ws.send(e.toString())
    }
    
}

/*async function runConversationCohere(data, ws, prompt) {
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
        let max = 0;
        for (const element of content["Characters"]) {

            const imageLink = await generateImage(data, ws, element["Type"] + ", " + element["Description"] + ", cartoony")

            jsonDump["Characters"].push({ "Type": element["Type"], "Actions": element["Actions"], "Size": element["Size"], "Sprite": imageLink })


        }
        console.log(jsonDump)
        ws.send(JSON.stringify(jsonDump))
    } catch(e) {
        console.error(e)
        ws.send(e.toString())
    }
}*/

async function generateScenes(data, ws, prompt) {
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
            max_tokens: 1000,
            truncate: 'END',
            return_likelihoods: 'NONE',
            prompt: initSceneMsg + prompt + `"`, 
            temperature: 0.6,
            stopSequences: ["\\end"],
        }
    }
    try {
        const response = await axios.request(options)
        console.log(response.data.generations[0].text); 
        var content = JSON.parse(response.data.generations[0].text);
        ws.send(JSON.stringify({type: "numberScenes", value: content["Scenes"].length})) 
        for (const element of content["Scenes"]) {
            await runConversationGPT(data, ws, element); 
        }
    } catch(e) {
        console.error(e)
        ws.send(e.toString())
    }
}

async function generateImage(data, ws, prompt, bg) {
    try {
        const image = await openai.images.generate({ prompt: prompt, n: 1, size: bg ? "1024x1024" : "256x256" }); 

        var rndName = makeid(10)
        var base64str = ""
        // await downloadImage(image.data[0].url, "./images/"+rndName+".png")
        /*rembg({ apiKey: process.env.REMGB_API_KEY, inputImagePath: "./images/"+rndName+".png" }).then(({ outputImagePath, cleanup }) => {
            console.log("path " + outputImagePath); 
            base64str = base64_encode(outputImagePath)
        })*/

        // return base64str
        return image.data[0].url; 
        // return base64str
    } catch(e) {
        ws.send(e.toString())
    }
}

export async function prompt(data, ws) {
    const prompt = data
    //await runConversationCohere(data, ws, prompt)
    // await runConversationGPT(data, ws, prompt)
    //await generateImage(data, ws, prompt)
    const promises = [
        // generateScenes(data, ws, prompt),
        generateMusic(data, ws, prompt),
        generateScenes(data, ws, prompt),
        // emotionDetection(data, ws, prompt)
        // Add more functions to run concurrently here if needed
    ];

    // Wait for all promises to resolve before continuing
    await Promise.all(promises);
    ws.send(JSON.stringify({type: "success"}))
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

export async function generateMusic(data, ws, prompt) {
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
            return_likelihoods: 'NONE',
            temperature: 0.3,
            // prompt: 'Describe the tone of ' + `"${prompt}"` + " in a single adjective."
            prompt: 'You are a summarizer. Given an input scenario, provide a single adjective as response.\nScenario: ' + `"${prompt}"` + "\nYour adjective response: ",
        }
      };
      
    const response = await axios.request(options)
    const theme = response.data.generations[0].text.split(".")[0].trim()
    console.log(theme)
    
    var youtube = google.youtube({
        version: 'v3',
        auth: process.env.YOUTUBE_API_KEY
    });

    youtube.search.list({
        part: 'snippet',
        q: theme + "music",
        maxResults: 10,
        type: 'video',
        videoDuration: 'short'
    }, function (err, response) {
        if (err) {
            console.error('Error: ' + err);
            return
        }
        const videos = response.data.items;
        let randomVideo
        for (const video of videos) {
            if (video.id.videoId !== undefined) {
                randomVideo = video
                break
            }
        }
        
        const videoLink = `https://www.youtube.com/watch?v=${"2jsdadaokw"}`
       //

        ws.send(JSON.stringify({ type: "youtube", value: videoLink}))
    });
}

async function downloadImage(url, filepath) {
    return new Promise((resolve, reject) => {
        client.get(url, (res) => {
            if (res.statusCode === 200) {
                res.pipe(fs.createWriteStream(filepath))
                    .on('error', reject)
                    .once('close', () => resolve(filepath));
            } else {
                // Consume response data to free up memory
                res.resume();
                reject(new Error(`Request Failed With a Status Code: ${res.statusCode}`));
            }
        });
    });
}

function base64_encode(file) {
    // read binary data
    var bitmap = fs.readFileSync(file);
    // convert binary data to base64 encoded string
    return new Buffer(bitmap).toString('base64');
}

function makeid(length) {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    let counter = 0;
    while (counter < length) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
      counter += 1;
    }
    return result;
}