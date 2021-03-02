const Twitter = require("twitter-lite");
const secrets = require("./secrets.json");

const client = new Twitter({
    consumer_key: secrets.TWITConsumerKey,
    consumer_secret: secrets.TWITConsumerSecret,
    access_token_key : secrets.TWITAuthToken,
    access_token_secret: secrets.TWITAuthSecret
  });
  
const tweet = async (message1, message2) => {
    const tweet1 = await client.post('statuses/update', { status: message1 }).catch(console.error);

    const lastTweetID = tweet1.id_str;
    await client.post('statuses/update', { status: message2, in_reply_to_status_id: lastTweetID }).catch(console.error);
}

(async => {
    tweet("First Message", "Reply");
})();
  