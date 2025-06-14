require('dotenv').config();
const axios = require("axios");
const { App } = require('@slack/bolt');
const {encode, decode} = require('gpt-3-encoder');



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
  } catch (error) {
    console.error('Error:', error);
  }
})();


(async () => {
    await app.start(process.env.PORT || 3000);
    console.log('Bolt app is running!');
})();

app.message(async ({ message, say }) => {
  const channelId = message.channel;
  
  if(await isBotInChannel(channelId)){
    console.log("bot is member");
    say("sape");
  } else{
    console.log("no estoy");
  }
});
async function isBotInChannel(channelId) {
  try {
    const conversation = await app.client.conversations.members({
      token: process.env.SLACK_BOT_TOKEN,
      channel: channelId,
    });

    const memberIds = conversation.members;
    // Check if the bot ID or user ID matches any member ID
    return memberIds.includes(appId) || memberIds.includes(botId);
  } catch (error) {
    console.error('Error:', error);
    return false;
  }
}
