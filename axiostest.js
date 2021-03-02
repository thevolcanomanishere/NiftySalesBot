const axios = require('axios');

// axios.get('https://api.niftygateway.com//user/profile-and-offchain-nifties-by-url/\?profile_url\=turbojob9000').then(res => {
//     console.log(res.data)
// })

const niftyProfileUrl = 'https://api.niftygateway.com//user/profile-and-offchain-nifties-by-url/\?profile_url\=';


const getNiftyProfile = async (profileName) => {
    return { data } = await axios.get(niftyProfileUrl + profileName)
}

(async () => {
    console.log(await getNiftyProfile("turbojob9000"));
})();
