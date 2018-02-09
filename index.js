const axios = require('axios')
const jwt = require('jsonwebtoken')
const { stringify } = require('querystring')
const { parse: urlParse } = require('url')
const redirect = (res, location, statusCode = 302) => { res.statusCode = statusCode; res.setHeader('Location', location); res.end() }
const urlBodyParse = require('urlencoded-body-parser')
const pkg = require('./package.json')
let config = require('./config')

function log (level, message) {
  if (config.debug) {
    const formatedMessage = typeof message === 'object' ? JSON.stringify(message) : message
    console.log(`[${level.toUpperCase()}] ${new Date().toUTCString()} ${pkg.name} - ${pkg.version}: ${formatedMessage}`)
  }
}

async function setup (handler) {
  try {
    log('info', `Requesting metadata from ${config.autodiscover_url}`)
    const { data: metadata } = await axios.get(config.autodiscover_url)
    log('info', `Got data from ${config.autodiscover_url}`)
    config.metadata = metadata
    log('info', `Requesting metadata from ${metadata.jwks_uri}`)
    const { data: keyData } = await axios.get(metadata.jwks_uri)
    log('info', `Got data from ${metadata.jwks_uri}`)
    config.keys = keyData.keys
    return handler
  } catch (error) {
    throw error
  }
}

async function getToken (code) {
  const payload = stringify({
    client_id: config.auth.client_id,
    code,
    redirect_uri: config.auth.redirect_uri,
    resource: 'https://graph.microsoft.com',
    client_secret: config.client_secret,
    grant_type: config.grant_type
  })

  log('info', `Retriving token from ${config.metadata.token_endpoint}`)

  try {
    const { data } = await axios.post(config.metadata.token_endpoint, payload)
    log('info', `Got token from ${config.metadata.token_endpoint}`)
    return data
  } catch (error) {
    throw error.response ? error.response.data : error
  }
}

function validateToken (data) {
  const decodedToken = jwt.decode(data.id_token, {complete: true})
  const { x5c } = config.keys.find(key => decodedToken.header.x5t === key.x5t)
  const pubCert = `-----BEGIN CERTIFICATE-----\n${x5c}\n-----END CERTIFICATE-----`
  let verifiedToken
  try {
    verifiedToken = jwt.verify(data.id_token, pubCert)
  } catch (error) {
    throw error
  }
  if (data.state !== config.auth.state) {
    throw Error('Failed to login - Invalid state')
  } else if (verifiedToken.iss !== config.metadata.issuer) {
    throw Error('Failed to login - Invalid issuer')
  } else if (verifiedToken.nonce !== config.auth.nonce) {
    throw Error('Failed to login - Invalid nonce')
  }
  return verifiedToken
}

async function getUserInfo (token) {
  try {
    log('info', `Retrieving user info from ${config.graph_user_info_url}`)
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
    const httpJobs = config.graph_user_info_url.map(url => axios(url))
    const results = await Promise.all(httpJobs)
    return results.map(el => el.data)
  } catch (error) {
    console.log(error.response.data)
    throw error.response ? error.response.data : error
  }
}

async function login (req, res) {
  const params = stringify(config.auth)
  log('info', `Authorizing through ${config.metadata.authorization_endpoint}`)
  redirect(res, `${config.metadata.authorization_endpoint}?${params}`)
}

async function logout (req, res) {
  const params = stringify({ post_logout_redirect_uri: config.domain })
  log('info', `Logging out through ${config.metadata.end_session_endpoint}`)
  redirect(res, `${config.metadata.end_session_endpoint}?${params}`)
}

async function callback (req, res) {
  log('info', `Recivied callback data`)
  const callbackData = await urlBodyParse(req)
  const profile = validateToken(callbackData)
  log('info', `Validated token`)
  if (!config.graph_user_info_url) return profile

  try {
    log('info', `Retrieving graph api token`)
    const token = await getToken(callbackData.code)
    const userProfile = await getUserInfo(token.access_token)
    return Object.assign(profile, { token, userProfile })
  } catch (error) {
    throw error
  }
}

module.exports = setup((req, res) => {
  const { pathname } = urlParse(req.url, true)
  if (pathname === '/api/login') {
    return login(req, res)
  } else if (pathname === '/api/logout') {
    return logout(req, res)
  } else if (pathname === '/api/callback') {
    return callback(req, res)
  } else if (pathname === '/favicon.ico') {
    return ''
  } else {
    return { message: '(Nothing but) Flowers' }
  }
})
