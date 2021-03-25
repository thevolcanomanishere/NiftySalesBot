const axios = require('axios');

// axios.get('https://api.niftygateway.com//user/profile-and-offchain-nifties-by-url/\?profile_url\=turbojob9000').then(res => {
//     console.log(res.data)
// })

const niftyProfileUrl = 'https://api.niftygateway.com//user/profile-and-offchain-nifties-by-url/\?profile_url\=';

const niftyPriceFloor = "https://api.niftygateway.com//already_minted_nifties/?searchQuery=%3Fpage%3D1%26search%3D%26collection%3D0xe9be55ffedb6c2a2f3f8eac31c60d7f122f79958%26type%3D1%26order%3Dasc%26orderType%3Dprice%26onSale%3Dtrue&page=%7B%22current%22:1,%22size%22:20%7D&filters=%7B%22contract_address%22:%220xe9be55ffedb6c2a2f3f8eac31c60d7f122f79958%22,%22nifty_type_that_created%22:%221%22,%22currently_on_sale%22:true%7D&sort=%7B%22price_in_cents%22:%22asc%22%7D"

const niftyPriceFloor2 = `https://api.niftygateway.com//already_minted_nifties/?searchQuery=?page=1&search=&collection=0xe628ef7988227e58ff93d9898706aa106aa5608c&type=1&order=asc&orderType=price&onSale=true&page={"current":1,"size":20}&filters={"contract_address":"0xe628ef7988227e58ff93d9898706aa106aa5608c","nifty_type_that_created":"5","currently_on_sale":true}&sort={"price_in_cents":"asc"}`
console.log(decodeURIComponent(niftyPriceFloor2));
const getNiftyProfile = async (profileName) => {
    return { data } = await axios.get(niftyProfileUrl + profileName)
}

const getFloor = async () => {
    const response = await axios.get(niftyPriceFloor2);
    return response.data;
}

(async () => {
    const data = await getFloor();
    const sorted = data.data.results.sort((a, b) => {
        return a.price_in_cents - b.price_in_cents;
    })

    console.log(data);
    data.data.results.forEach(item => console.log(item.price_in_cents));
})();
