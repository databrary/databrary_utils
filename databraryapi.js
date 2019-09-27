const qs = require('qs')
const request_mod = require('request')
const logger = require('./logger')
const path = require('path')
const url = require('url')
const fs = require('fs')

const API_URL = 'https://nyu.databrary.org/api'

const request_cookie = request_mod.jar();
const request = request_mod.defaults({jar:request_cookie})

function get_all_db_session(volume_id) {
    const uri = API_URL + '/volume/' + volume_id + '?containers'
    const options = {
        url: url.parse(uri),
        method: 'GET',
        headers: {
            'User-Agent': 'request'
        }
    }
    return new Promise(function (resolve, reject) {

        request(options, function(error, response, body){
            if(response.statusCode === 200) {
                resolve(JSON.parse(body)['containers'])
            } else {
                reject(`Status Code ${response.statusCode}`)
            }
        })
    }).catch(function(error){
        logger.error(`Error: ${error}`)
    })
}

function connect_to_db(username, password) {
    let connected = false
    const uri = API_URL + '/user/login'
    const payload = {
        "email": username,
        "password": password
    }

    const options = {
        method: 'POST',
        url: url.parse(uri),
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
                reject(`Status Code ${response.statusCode}`)
            }
        })
    }).catch(function(error){
        logger.error(`Error: ${error}`)
    })
}

function logout_from_db() {
    const uri = API_URL + '/user/logout'
    const options = {
        method: 'POST',
        url: url.parse(uri),
        resolveWithFullResponse: true,
    }

    return new Promise(function (resolve, reject) { 
        
        request(options, function (error, response, body) {
            if (response.statusCode === 200) {
                logger.debug(`User successfully disconnected`)
                resolve(true)
            } else {
                reject(`Status Code ${response.statusCode}`)
            }
        })
    }).catch(function(error){
        logger.error(`Error: ${error}`)
    })
}

function get_session_assets(volume_id, session_id) {
    const qsObj= qs.parse('assets=1')
    const uri = API_URL + '/volume/' + volume_id + '/slot/' + session_id
    const options = {
        url: url.parse(uri),
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
                reject(`Status Code ${response.statusCode}`)
            }
        })
    }).catch(function(error){
        logger.error(`Error: ${error}`)
    });
}

function get_volume_csv(volume_id, download_dir) {
    try {
        fs.statSync(download_dir)
        logger.debug(`Directory ${download_dir} exists`)
    } catch(e) {
        fs.mkdirSync(download_dir)
        logger.debug(`Make ${download_dir} Directory`)
    }
    /* Create an empty file where we can save data */
    const uri = 'https://nyu.databrary.org/volume/'+volume_id+'/csv'
    const options = {
        url: url.parse(uri),
        method: 'GET',
        headers: {
            'User-Agent': 'request'
        }
    }

    return new Promise(function (resolve, reject) {
        request(options, function (error, response, body) {
            if (response.statusCode === 200) {
                var filename, contentDisp = response.headers['content-disposition'];
                if (contentDisp && /^attachment/i.test(contentDisp)) {
                    filename = contentDisp.toLowerCase()
                        .split('filename=')[1]
                        .split(';')[0]
                        .replace(/"/g, '');
                } else {
                    filename = path.basename(url.parse(uri).path);
                }
                logger.info(`File name ${filename}`);
                fs.createWriteStream(path.join(download_dir, filename)).write(body);
                resolve(path.join(download_dir, filename))
            } else {
                reject(`Status Code ${response.statusCode}`)
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
    get_all_db_session: get_all_db_session,
    get_volume_csv: get_volume_csv
}