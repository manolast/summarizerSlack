require('dotenv').config();
const { App } = require('@slack/bolt');
const {encode} = require('gpt-3-encoder');
const axios = require("axios");
const openaiApiKey = process.env.OPEN_AI_API_KEY;

const app = new App({
    token: process.env.SLACK_BOT_TOKEN,
    signingSecret: process.env.SLACK_SIGNING_SECRET
});

let botId;
let appId;
(async () => {
    try {
      const authTestResponse = await app.client.auth.test({
        token: process.env.SLACK_BOT_TOKEN,
      });
      botId = authTestResponse.bot_id;
      appId = authTestResponse.user_id;
      console.log('Bot ID:', botId);
      console.log('App ID:', appId);
  
      await app.start(process.env.PORT || 3000);
      console.log('Bolt app is running!');
    } catch (error) {
      console.error('Error:', error);
    }
})();

const promptSinVariables = `Instructions: Generate a TLDR (summary) of the conversation based on the provided messages and previous TLDR.

####
Context:
The previous TLDR serves as context for generating the summary.
TLDR: 

Messages:

####
Summary:`
const tokensSinVariables = encode(promptSinVariables).length;

let mensajes = "";
let ultimoTLDR = "There is no last context.";

app.message(async ({ message, say }) => {
    const channelId = message.channel;

    //checkeamos si no se arrobo al bot para dejar de lado la funcion de abajo y que se ejecute el mention
    //tambien checkeamos que el bot este integrado en el canal con isBotInChannel
    if(isBotInChannel(channelId) && !message.text.includes(`@${botId}`) && !message.text.includes(`@${appId}`)){
        const userInfo = await app.client.users.info({
            token: process.env.SLACK_BOT_TOKEN,
            user: message.user
        });
        //si tiene un display name lo llama por ese nombre (suele ser mas corto e identificador) si no lo llama por el nombre
        let userName = userInfo.user.display_name || userInfo.user.name;
        const content = message.text;
        const lastMessage = `${userName}: ${content}\n`;
        //sumo los tokens de todos los strings, si se pasa del limite (dejamos un margen por las dudas) se genera el resumen y se envia
        if(encode(mensajes).length + encode(lastMessage).length + encode(ultimoTLDR).length + tokensSinVariables > 3500){
            await generarYMandarResumen(ultimoTLDR, mensajes, say);
            mensajes = lastMessage;
        } else {
            mensajes += lastMessage;
        }
    }
  });

app.event('app_mention', async ({ event, say }) => {
    await generarYMandarResumen(ultimoTLDR, mensajes, say);
  });

async function generarYMandarResumen(context, messages, say) {
    try {
        const summary = await generateTLDR(context, messages);
        await say(`Summary: ${summary}`);
        //se asgina mensajes vacio por default. Si se genero y envio el mensaje por tope de tokens, se va a asignar de otra manera alli
        mensajes = "";
        ultimoTLDR = summary;
    } catch (error) {
        console.error('Error:', error.message);
        await say('Ocurrió un error al generar el resumen. Por favor, inténtalo de nuevo.');
    }
  }

async function generateTLDR(context, messages) {
    try {
        const response = await axios.post('https://api.openai.com/v1/completions', {
            prompt: `Instructions: Generate a TLDR (summary) of the conversation based on the provided messages and previous TLDR.
  
            ####
            Context:
            The previous TLDR serves as context for generating the summary.
            TLDR: ${context}
        
            Messages:
            ${messages}

            ####
            Summary:
            `,
            model: "text-davinci-003",
            max_tokens: 4000,
            temperature: 0.1, 
            n: 1,
            stop: '\n',
        }, {
            headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openaiApiKey}`,
        },
        });
        const tldrSummary = response.data.choices[0].text;
        return tldrSummary;
    } catch (error) {
        console.error('Error:', error.message);
        throw new Error('Failed to generate the summary');
    }
}
async function isBotInChannel(channelId) {
    try {
        const conversation = await app.client.conversations.members({
            token: process.env.SLACK_BOT_TOKEN,
            channel: channelId,
        });
        const memberIds = conversation.members;
        return memberIds.includes(appId) || memberIds.includes(botId);
    } catch (error) {
        console.error('Error:', error);
        return false;
    }
  }