const puppeteer = require('puppeteer-core');
const TeleBot = require('telebot');
const MongoClient = require('mongodb').MongoClient;
const Twitter = require("twitter-lite");
const secrets = require("./secrets.json");
const axios = require('axios');
const uri = secrets.mongoURI;
const bot = new TeleBot("1644508566:AAEvtoD1SamVrDHGaallta-MGj7UTf8KMT8");
const adminTelegramId = "879556888";
const channelId = "-1001342081499";
const niftyProfileUrl = 'https://api.niftygateway.com//user/profile-and-offchain-nifties-by-url/\?profile_url\=';

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

bot.on('text', (msg) => {
  if(msg.text === "Ping"){
    msg.reply.text("Pong")
  }
});

bot.on('/update', (msg) => {
  msg.reply.text("Updating profiles");
  
})

bot.start();

const sendTelegram = (id, text) => {
  bot.sendMessage(id, text);
}

const convertToFiat = (cents) => cents / 100;

let profileCollection;
let watchlistCollection;

const getNiftyProfile = async (profileName) => {
  const { data } = await axios.get(niftyProfileUrl + profileName);
  return data;
}

const createIdentifier = (contractAddress, niftyTotalSold, niftyPrice) => `${contractAddress}${niftyTotalSold}${niftyPrice}`;

const createShortUrlForNifty = (contractAddress, tokenId) => {
  try {
    const longUrl = `https://niftygateway.com/itemdetail/secondary/${nifty.contractAddress}/${nifty.tokenId}`;
    const { data : shortUrl } = await axios.get(`https://tinyurl.com/api-create.php?url=${longUrl}`);
    return shortUrl;
  } catch (error) {
    return 'NOURL';
  }
}

let watchList = [];


const updateWatchList = async() => {
  const profiles = await profileCollection.find().toArray();
  let localWatch = [];
  profiles.forEach(profile => {
    const { teleId, profileName, nifties } = profile;  
    const unfilteredProfile = nifties.map(nifty => {
      const { unmintedNiftyObjThatCreatedThis, contractAddress, tokenId } = nifty;
      const { niftyTotalSold, niftyPriceInCents } = unmintedNiftyObjThatCreatedThis;
      const niftyPrice = convertToFiat(niftyPriceInCents);
      const identifier = createIdentifier(contractAddress, niftyTotalSold, niftyPrice);

      return {
        identifier,
        profileName,
        tokenId,
        teleId,
        contractAddress,
        niftyTotalSold,
        niftyPrice,
        latestPrice: niftyPrice
      }
    })

    const seen = new Set();

    const filteredArr = unfilteredProfile.filter(el => {
      const unique = el.identifier;
      const duplicate = seen.has(unique);
      seen.add(unique);
      return !duplicate;
    });

    localWatch.push(...filteredArr)
  
  })

  // const seen = new Set();

  // const filteredArr = localWatch.filter(el => {
  //   const unique = el.identifier + el.teleId;
  //   const duplicate = seen.has(unique);
  //   seen.add(unique);
  //   return !duplicate;
  // });

  watchList = localWatch;
  try {
    await watchlistCollection.deleteMany({});
    await watchlistCollection.insertMany(localWatch);
  } catch (error) {
    console.log(error)
  }
}

bot.on(/^\/sub (.+)$/, async (msg, props) => {
  const profileName = props.match[1];

  let mongoProfile = {
    profileName,
    teleId : msg.from.id
  };

  bot.sendMessage(msg.from.id, `Working`, { replyToMessage: msg.message_id });

  const profile = await getNiftyProfile(profileName);
  const nifties = profile.userProfileAndNifties.nifties;
  const photo = profile.userProfileAndNifties.profile_pic_url;

  if(nifties.length === 0){
    return bot.sendMessage(msg.from.id, `No nifties on account: ${profileName}`, { replyToMessage: msg.message_id });
  }

  const mongoProfileWithData = {
    ...mongoProfile,
    nifties
  };

  const update = {$set: mongoProfileWithData }
  await profileCollection.updateOne( mongoProfile, update, { 
    upsert: true
  });

  const text = `You are subscribing to sales for profile: ${profileName}\nCurrent nifties: ${nifties.length}`;
  await updateWatchList();
  await msg.reply.photo(photo)
  return bot.sendMessage(msg.from.id, text, { replyToMessage: msg.message_id });
});

bot.on(/^\/unsub (.+)$/, async (msg, props) => {
  const profileName = props.match[1];

  await profileCollection.deleteOne({profileName, teleId: msg.from.id});
  await updateWatchList();
  return bot.sendMessage(msg.from.id, `Unsubbed from ${profileName}`, { replyToMessage: msg.message_id });
});


sendTelegram(adminTelegramId, 'Server Up');

let previousTickArray = [];

const getEditionNumber = name => {
  return name.substring(name.indexOf("#") + 1, name.indexOf("/"));
}

const createUpdateText = (profileName, project_name, name, SaleAmount, priceChangeFactor, profit, niftyPrice) => {
  return `Profile: ${profileName}\nProject: ${project_name}\nName: ${name}\n$${niftyPrice} -> $${SaleAmount}\nChange Factor:🚀 ${priceChangeFactor}x\nProfit: $${profit}`
}

const createChannelText = (project_name, name, SaleAmount, priceChangeFactor, profit, niftyPrice, shortUrl) => {
  return `Project: ${project_name}\nName: ${name}\n$${niftyPrice} -> $${SaleAmount}\nChange Factor:🚀 ${priceChangeFactor}x\nURL: ${shortUrl}\nProfit: $${profit}`
}

const createTwitterText1 = (project_name, name, SaleAmount, priceChangeFactor, profit, niftyPrice) => {
  return `Project: ${project_name}\nName: ${name}\n$${niftyPrice} -> $${SaleAmount}\nChange Factor:🚀 ${priceChangeFactor}x\nProfit: $${profit}`
}

const createTwitterText2 = (tokenId, contractAddress) => {
  const url = `https://niftygateway.com/itemdetail/secondary/${contractAddress}/${tokenId}`
  return `Link: ${url}`
}

 
const checkWatchList = (niftyObjects) => {
  niftyObjects.forEach(niftyObject => {
    if(niftyObject.Type === "listing") return;
    // send messages to all channel
    const shortUrl = createShortUrlForNifty(niftyObject.contractAddress, niftyObject.tokenId);
    const channelText = createChannelText(niftyObject.project_name, niftyObject.name, niftyObject.SaleAmount, niftyObject.priceChangeFactor, niftyObject.profit, niftyObject.niftyPrice, shortUrl);
    const twitterText1 = createTwitterText1(niftyObject.project_name, niftyObject.name, niftyObject.SaleAmount, niftyObject.priceChangeFactor, niftyObject.profit, niftyObject.niftyPrice);
    const twitterText2 = createTwitterText2(niftyObject.tokenId, niftyObject.contractAddress);
    if(niftyObject.priceChangeFactor >= 2){
      // tweet(twitterText1, twitterText2);
    }
    sendTelegram(channelId, channelText);
    let matches = [];
    const identifierNifty = createIdentifier(niftyObject.contractAddress, niftyObject.niftyTotalSold, niftyObject.niftyPrice);
    watchList.map((watch, index) => {
      const identifierWatch = watch.identifier;
      if(identifierNifty === identifierWatch){
        const { SaleAmount } = niftyObject;
        matches.push(index);
        return {
          ...watch,
          lastestPrice: SaleAmount
        }
      }
      return watch;
    });

    matches.forEach(match => {
      const text = createUpdateText(watchList[match].profileName, niftyObject.project_name, niftyObject.name, niftyObject.SaleAmount, niftyObject.priceChangeFactor, niftyObject.profit, niftyObject.niftyPrice)
      console.log(text);
      sendTelegram(watchList[match].teleId, text);
    })
  });
}

const checkListings = (NiftyObjects) => {
  NiftyObjects.forEach( async nifty => {
    if(nifty.Type === "sale") return;
    const { ListingAmountInCents, niftyPriceInCents, project_name, name, Timestamp } = nifty;
    if(ListingAmountInCents < niftyPriceInCents){
      const percentBelowSale = Math.round(((niftyPriceInCents / ListingAmountInCents) * 100 * -1) - 100);
      if(percentBelowSale < 10) return;
      const listingPrice = convertToFiat(ListingAmountInCents);
      const salePrice = convertToFiat(niftyPriceInCents);
      const date = new Date(Timestamp);
      const dateFormatted = `${date.getDay()}/${date.getMonth()}/${date.getFullYear()}`;
      const longUrl = `https://niftygateway.com/itemdetail/secondary/${nifty.contractAddress}/${nifty.tokenId}`;
      const { data : shortUrl } = await axios.get(`https://tinyurl.com/api-create.php?url=${longUrl}`);
      const text = `Project: ${project_name}\nName: ${name}\nDate Listed: ${dateFormatted}\n$${salePrice} -> $${listingPrice}\nURL: ${shortUrl}\nDiff: -${percentBelowSale}%`;
      sendTelegram(adminTelegramId, text);
    }
  })
}

const processListing = (NiftyObject) => {
  const { ListingAmountInCents } = NiftyObject;
  const { contractAddress, project_name, name, tokenId, id} = NiftyObject.NiftyObject;
  const { Timestamp } = NiftyObject.NiftyObject.unmintedNiftyObjThatCreatedThis;
  const { niftyTotalSold, niftyPriceInCents } = NiftyObject.NiftyObject.unmintedNiftyObjThatCreatedThis;

  const date = new Date(Timestamp);

  if(ListingAmountInCents < niftyPriceInCents){
    return {
      Type: "listing",
      id,
      ListingAmountInCents,
      contractAddress,
      project_name,
      name,
      tokenId,
      Timestamp: date,
      niftyTotalSold, 
      niftyPriceInCents
    }
  }
}


const justTheBestBits = (object) => {
  switch (object.Type) {
    case "offer":
      return;
    case "listing":
      return processListing(object);
    case "sale":
      break;
    case "nifty_transfer":
      return;
    case "birth":
      return;
    case "withdrawal":
      return;
    case "bid":
      return;
    default:
      sendTelegram(adminTelegramId, object.Type)
      return;
  }

  try {
    const { Timestamp, SellingUserProfile, PurchasingUserProfile, Type, id,
      SaleAmountInCents} = object;
   const { contractAddress, project_name, project_slug, name, tokenId} = object.NiftyObject;
   const { template } = object.NiftyObject.unmintedNiftyObjThatCreatedThis.contractObj;
   const { niftyTotalNumOfEditions, niftyTotalSold, niftyPriceInCents} = object.NiftyObject.unmintedNiftyObjThatCreatedThis;
   const whenListed = new Date(object.NiftyObject.unmintedNiftyObjThatCreatedThis.Timestamp);
   const priceChangeFactor = Math.round(SaleAmountInCents / niftyPriceInCents * 100) / 100;
   
   const niftyPrice = convertToFiat(niftyPriceInCents);
   const SaleAmount = convertToFiat(SaleAmountInCents);

   const identifier = `${contractAddress}${niftyTotalSold}${convertToFiat(niftyPriceInCents)}`

   const profit = Math.round((SaleAmount * 0.85) - niftyPrice);

   if(template === "pack"){
     return;
   }
   return {
     Type: "sale",
     Timestamp : new Date(Timestamp),
     identifier,
     whenListed,
     SellingUserProfile,
     PurchasingUserProfile,
     Type,
     id,
     SaleAmount,
     contractAddress,
     project_name,
     project_slug,
     name,
     tokenId,
     template,
     niftyTotalNumOfEditions,
     niftyTotalSold,
     niftyPrice,
     priceChangeFactor,
     profit
   }
  } catch (error) {
    sendTelegram(error);
    sendTelegram(adminTelegramId,`Nifty Name: ${object.NiftyObject.name}\nType: ${object.Type}`)
    return;
  }
}


(async () => {
    const client = await MongoClient.connect(uri, { useNewUrlParser: true })
        .catch(err => { 
          sendTelegram(adminTelegramId, "Database connection error");
          sendTelegram(adminTelegramId, err)
          console.log(err); 
        });

    if (!client) {
        return;
    }

    const collection = client.db("NiftyGateway").collection("sitewide");
    profileCollection = client.db("NiftyGateway").collection("profiles");
    watchlistCollection = client.db("NiftyGateway").collection("watchlist");
    await updateWatchList();

    let browser;
    if(process.arch === "arm"){
      browser = await puppeteer.launch({executablePath: '/usr/bin/chromium-browser'});
    } else {
      browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
    }
    try {
        const page = await browser.newPage()
        await page.on('response', async response => {
            // Ignore OPTIONS requests
            if (response.url().includes('//market/all-data/')) {
                console.log("Working");
                // console.log('\n 🚀 We got one!: ', response.url())
                const data = await response.json();
                const formattedShrunk = data.data.results.map((nifty => {
                  return justTheBestBits(nifty);
                })).filter(item => item !== undefined);


                if(formattedShrunk.length === 0){
                  console.log("Zilch");
                  return;
                }

                console.log("Previous: ", previousTickArray);

                let removeDupes = [];
                //First run
                if(previousTickArray.length === 0){
                  previousTickArray = formattedShrunk.map(item => item.id);
                  let result = await collection.insertMany(formattedShrunk);
                  sendTelegram(adminTelegramId, `Inserted ${result.insertedCount}`);
                  return;
                } else {
                  //Second run
                  removeDupes = formattedShrunk.filter(item => {
                    return !previousTickArray.includes(item.id);
                  }).filter(item => item !== undefined);
                }
                console.log("Current: ", removeDupes.map(item => item.id));

                if(removeDupes.length === 0) return;

                previousTickArray = formattedShrunk.map(item => item.id);

                let result = await collection.insertMany(removeDupes);
                checkWatchList(removeDupes);
                await checkListings(removeDupes);
                console.log("New added: ", removeDupes.map(item => item.id));
                console.log("New filter list :", previousTickArray);
                console.log("-------")
            }
        })
        // navigate to a page
        const pageUrl = 'https://niftygateway.com/sitewide-activity'
        await page.goto(
            pageUrl, {waitUntil: 'networkidle0'}
        )
} catch (err){
  console.log(err)
  client.close();
} finally {
    }
})();
