const _ = require('lodash')
const fs = require('fs')
const config = require('config')
const puppeteer = require('puppeteer')
const path = require('path');
const api = require('./databraryapi')
const logger = require('./logger')
const yargs = require('yargs')

var argv = yargs
    .usage('Usage: $0 <v \"volume\"> <-u \"username\"> <-p \"password\">')
    .epilog('This scripts will upload opf files found in folder opfs/ to a specific volume by matching the video name (if there is any) with the opf file name $0 [options]')
    .help('h').alias('h', 'help')
    .version('version', '0.0.1').alias('V', 'version')
    .options({
        'v': {
            alias: 'volume',
            description: 'Volume ID',
            requiresArg: true,
            required: true,
            type: Number
        },
        'u': {
            alias: 'username',
            description: 'Databrary username',
            requiresArg: true,
            required: false,
            type: String
        },
        'p': {
            alias: 'password',
            description: 'Databrary password',
            requiresArg: true,
            required: false,
            type: String
        }
    })
    .example('node uploadOpfs.js -v 000 -u me@gmail.com -p password', 'Upload OPF files in /opfs to me@gmail.com databrary account, volume 000')
    .showHelpOnFail(false, 'whoops, something went wrong! run with --help')
    .argv

const opfs_directory = 'opfs/'
const directoryPath = path.join(__dirname, opfs_directory);
const URL = 'https://nyu.databrary.org'
const VOLUME = argv.volume
let username = config.get('credentials.username')
let password = config.get('credentials.password')

if (argv.username && argv.password) {
    logger.debug(`Found username and password arguments`)
    username = argv.username
    password = argv.password
}

/*
 * Connect to Databrary
 */
async function connect(page, url, username, password) {
    let connected = false
    await page.goto(url);
    await page.waitFor('button.login-button');
    await page.click('button.login-button');
    logger.debug('Connect to Databrary');
    try {
        await page.waitFor('input#loginEmail')
        await page.click('input#loginEmail')
        await page.keyboard.type(username)
        await page.click('input#loginPassword')
        await page.keyboard.type(password)
        await page.click('button#loginSubmit')
        const [returnedCookie] = await page.cookies()
        // logger.debug(`Cookie: ${returnedCookie.length}`)
        connected = true
    } catch (error) {
        const classes = await page.$eval('a[href="/user/login"]', el => el.className)
        logger.error(`Error ${error.message}`)
    }

    return connected
}

async function navigateTo(page, url) {
    let pageLoaded = false;
    try {
        logger.debug('Go to ' + url);
        await page.goto(url, {
            waitUntil: 'networkidle2'
        });
        pageLoaded = true;
    } catch (error) {
        logger.error('Failed to go to ' + url);
    }
    return pageLoaded;
}

async function uploadOPF(page, url, file_path) {
    const page_loaded = await navigateTo(page, url)
    if (page_loaded) {
        // await page.waitFor('div.slot-toolbaar')
        await page.click('button[ng-click="addBlank()"]')
        logger.debug('Waiting from drop file')
        await page.waitFor('div.file-drop')
        try {
            const elementHandle = await page.$('input[type="file"]')
            logger.debug('Uploading File ' + file_path)
            await elementHandle.uploadFile(file_path)
        } catch (error) {
            logger.error(`File ${file_path} upload to ${url} Failed - Error: ${error}`)
        }
    }
}

function get_local_opf_file(asset_name) {
        var opf_path = null
        fs.readdirSync(directoryPath).forEach(function (file) {
                // Do whatever you want to do with the file
                let video_name = asset_name
                if (asset_name.includes(".")){
                    video_name = asset_name.substring(0, asset_name.length - 4)
                }
    
                if(file.substring(file.length - 3, file.length) === 'opf'){
                    const opf_name = file.substring(0, file.length - 4)
    
                    if (video_name.toLowerCase().includes(opf_name.toLowerCase())) {
                        const file_path = path.join(directoryPath,file)
                        logger.debug(`OPF path ${file_path} matches ${video_name}`)
                        opf_path = file_path
                    }
                }
        })
        return opf_path
}

async function get_db_data() {
    let sessions_assets = []
    const connected = await api.connect_to_db(username, password)
    if (connected) {
        let sessions_list = await api.get_all_db_session(VOLUME)
        if (sessions_list.length > 0) {
            logger.debug(`Found ${sessions_list.length} sessions`)
            for (i = 0; i < sessions_list.length; i++){
                logger.debug(`Scan session id ${sessions_list[i]['id']}`)

                let session_asset =  sessions_list[i]
                let assets = await api.get_session_assets(VOLUME, session_asset['id'])

                session_asset["assets"] = assets
                session_asset["url"] = `https://nyu.databrary.org/volume/${VOLUME}/slot/${session_asset['id']}/edit`
                
                // Will fail if there is more than one asset and there is no media
                if(assets.length > 0 && assets !== undefined) {
                        let asset = assets[0]
                        let asset_name = asset['name']
                        logger.debug(`Found asset name ${asset_name} in session ${session_asset['id']}`)
                        if (asset_name !== undefined){
                            logger.debug(`look for opf file that match ${asset_name} asset`)
                            const opf_path = get_local_opf_file(asset_name)
                            logger.debug(`OPF File path found ${opf_path}`)
                            if (opf_path !== null){
                                // logger.debug(`OPF File path found ${opf_path}`)
                                session_asset["OPF File"]=opf_path
                            } else {
                                logger.debug(`Cannot find opf file ${opf_path}`)
                            }
                        } 
                        sessions_assets.push(session_asset)
                } else {
                    logger.debug(`Didn\`t find assets in session ${session_asset['id']}`)
                }
            }
        }
    }
    logger.debug(JSON.stringify(sessions_assets))
    await api.logout_from_db()
    return sessions_assets
}

async function main() {
    let sessions = await get_db_data()
    const cookie = null;
    // Add these arguments if you want to see the browser in slow motion {headless: false, slowMo: 100}
    const browser = await puppeteer.launch({
        headless: false,
        slowMo: 150
    });
    // browser = await puppeteer.launch({
    //   headless: true
    // });
    const page = await browser.newPage();

    await page.addScriptTag({
        url: 'https://code.jquery.com/jquery-3.2.1.min.js'
    });

    page.on('error', err => {
        logger.error('error happen at the page: ', err);
    });

    page.on('console', msg => function (msg) {
        if (msg._type !== 'warning') {
            logger.debug(msg._text);
        }
    });

    if (cookie) {
        await page.setCookie(cookie);
    }

    const connected = await connect(page, URL, username, password)

    if (connected) {
        logger.debug(`Puppeteer is connected to DB: ${connected}`)
        logger.debug(`Sessions to upload = ${sessions.length}`)
        for (i = 0; i < sessions.length; i++){
            const url = sessions[i]["url"]
            const opf_path = sessions[i]["OPF File"]
            logger.debug(`URL: ${url} - OPF ${opf_path}`)
            if(url !== undefined && opf_path !== undefined) {
                logger.debug(`Upload ${url} to ${opf_path}`)
                await uploadOPF(page, url, opf_path)
            }
        }
    }

    await page.close();
    await browser.close();
}

// get_db_data()
main();