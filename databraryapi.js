const qs = require('qs')
const request_mod = require('request')
const logger = require('./logger')

const API_URL = 'https://nyu.databrary.org/api'

const request_cookie = request_mod.jar();
const request = request_mod.defaults({jar:request_cookie})

function get_all_db_session(volume_id) {

    return new Promise(function (resolve, reject) {
        const url = API_URL + '/volume/' + volume_id + '?containers'
        request(url, function(error, response, body){
            if(response.statusCode === 200) {
                resolve(JSON.parse(body)['containers'])
            } else {
                reject(error)
            }
        })
    });
}

function connect_to_db(username, password) {
    let connected = false
    const payload = {
        "email": username,
        "password": password
    }

    var options = {
        method: 'POST',
        uri: API_URL + '/user/login',
        resolveWithFullResponse: true,
        body: payload,
        json: true // Automatically stringifies the body to JSON
    };

    return new Promise(function (resolve, reject) { 
        
        request(options, function (error, response, body) {
            if (response.statusCode === 200) {
                logger.debug(`User ${username} successfully connected to Databrary`)
                resolve(true)
            } else {
                reject(error)
            }
        })
    });
}

function logout_from_db() {

    var options = {
        method: 'POST',
        uri: API_URL + '/user/logout',
        resolveWithFullResponse: true,
    };

    return new Promise(function (resolve, reject) { 
        
        request(options, function (error, response, body) {
            if (response.statusCode === 200) {
                logger.debug(`User ${username} successfully disconnected`)
                resolve(true)
            } else {
                reject(error)
            }
        })
    });
}

function get_session_assets(volume_id, session_id) {
    const qsObj= qs.parse('assets=1')
    const url = API_URL + '/volume/' + volume_id + '/slot/' + session_id
    const options = {
        url: url,
        method: 'GET',
        qs: qsObj,
        headers: {
            'User-Agent': 'request'
        }
    }

    return new Promise(function (resolve, reject) {
        request.get(options, function (error, response, body) {
            if (response.statusCode === 200) {
                    resolve(JSON.parse(body)["assets"])
            } else {
                reject(error)
            }
        })
    }).catch(function(error){
        logger.error(`Error: ${error}`)
    });
}

module.exports = {
    get_session_assets: get_session_assets,
    logout_from_db: logout_from_db,
    connect_to_db: connect_to_db,
    get_all_db_session: get_all_db_session
}