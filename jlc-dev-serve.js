#!/usr/bin/env node

// it's a slippery slope from here on
import mime from 'mime'
import * as os from 'os'
import * as fs from 'node:fs'
import * as net from 'node:net'
import * as zlib from 'node:zlib'
import * as http from 'node:http'
import * as https from 'node:https'
import * as chokidar from 'chokidar'
import * as liveReload from './liveReloadServer.js'
import {pipeline} from 'node:stream/promises'
const log = console.log

// so errors will look nicer (skips "double reporting")
process.on('uncaughtException', (error, origin) => {
  log('🤯', error)
  process.exit(1)
})

log('💾 Starting jlc-dev-serve...')

const config = {
  host: process.env.PUBLIC ? '::' : process.env.HOST || 'localhost',
  port: envNumber(process.env.PORT) ?? (process.env.HTTP ? 8080 : 4433),
  cert: process.env.CERT,
  key:  process.env.KEY,
  pass: process.env.PASS,
  http: envSwitch(process.env.HTTP),
  redirect: envNumber(process.env.REDIRECT),
  compression: envSwitch(process.env.COMPRESSION),
  ignore_index: envSwitch(process.env.IGNORE_INDEX),
  no_live_reload: envSwitch(process.env.NO_LIVE_RELOAD),
  no_directory_listing: envSwitch(process.env.NO_DIRECTORY_LISTING)
}
// get rid of undefined values and print the config
log('⚙️ Current configuration:', JSON.parse(JSON.stringify(config))) // alt. 🪛
// check for insane config
if (process.env.PUBLIC && process.env.HOST) {
  throw Error(`Can't set both PUBLIC and HOST, because PUBLIC will set the HOST for you.`)
}
if (config.http && config.cert) {
  throw Error(`Can't set both HTTP and CERT (a certificate is only used with HTTPS servers).`)
}
if (config.http && config.redirect) {
  throw Error(`Can't set both HTTP and REDIRECT (a redirect server is only used with HTTPS servers).`)
}
if (config.port < 0 || config.port > 65535) {
  throw Error(`Port (${config.port}) is not in the valid range of 0-65535.`)
}
if (config.cert && !config.key) {
  throw Error(`If using CERT you must also supply KEY.`)
}
if (!config.cert && config.pass) {
  throw Error(`If using PASS you must also supply CERT and KEY.`)
}

let isPublic
/** (doesn't allow tricks to escape further up in the filesystem) */
const filesServed = new Set()
const currentDirectory = process.cwd()
const server = await createServer()
server.once('listening', onceListening)
server.on('tlsClientError', (error, socket) => {
  log(`${getClock()} ${socket.remoteAddress} failed setting up a secure connection, maybe it tried to connect using the HTTP protocol.`)
})
log(`🔍 Scanning for files to serve in the "current directory" which is:\n   ${currentDirectory}`)
const watcher = chokidar.watch('.', {disableGlobbing: true})
watcher.once('ready', async () => { 
  log('🗃️',  filesServed.size, `files found, starting the ${config.http ? 'HTTP' : 'HTTPS'} server...`)
  await changePortIfNeeded()
  server.listen(config.port, config.host)
  if (!config.no_live_reload) {
    log(`🔁 Starting the LiveReload server...`)
    liveReload.start()
  }
})
watcher.on('all', (event, path) => {
  path = '/'+path
  switch (event) {
    case 'add':
      // when watching '.' (CWD) it returns a path relative to it
      if (process.platform == 'win32') { // if on Windows we convert the path separators to the URL format
        filesServed.add(path.replace('\\', '/'))
      } else {
        filesServed.add(path)
      }
    break
    case 'change':
      if (!config.no_live_reload) {
        liveReload.reportChange(path)
      }
    break
    case 'unlink':
      filesServed.delete(path)
    break
  }
})

function onceListening() {
  let address = server.address().address
  if (server.address().family == 'IPv6') {
    address = `[${address}]`
  }
  switch (address) {
    case '[::1]':
    case '127.0.0.1':
      address = 'localhost'
  }
  if (address == 'localhost') {
    log(`✅ Ready for connections on: ${config.http ? 'http' : 'https'}://${address}:${server.address().port}`)
    log(`🔒 (no access allowed outside of your computer) 🔒`)
  } else {
    isPublic = true
    log(`✅ Ready for connections on:`)
    console.group()
    const listeningAddresses = getListeningAddresses(address)
    for (const address of listeningAddresses) {
      log(`${config.http ? 'http' : 'https'}://${address}:${server.address().port}`)
    }
    console.groupEnd()
    log(`🔓🛑⚠️ WARNING: THE SERVED FILES ARE AVAILABLE TO ANY OTHER COMPUTER WHICH CAN ACCESS THOSE ADDRESSES! ⚠️🛑🔓`)
  }
  if (config.redirect) {
    createRedirectServer(address)
  }
}

async function createServer() {
  if (config.http) {
    return http.createServer(requestListener)
  } else {
    let key, cert, passphrase = config.pass
    if (config.cert) {
      log('🪪 Reading the certificate from: '+config.cert)
      try {
        key = envPEM('KEY', config.key)
        cert = envPEM('CERT', config.cert)
      } catch (error) {
        throw Error(`Failure reading files from the CERT and KEY paths.`, {cause: error})
      }
    } else { // use devcert then
      if (!['::1', '127.0.0.1', 'localhost'].includes(config.host.toLowerCase())) {
        throw Error(`Please supply your own certificate (CERT and KEY) for ${config.host}, since a "localhost" certificate will not work with it.`)
      }
      log('🪪 Getting a certificate for "localhost" (might require admin-privileges on first run)...')
      const devcert = await import('devcert')
      const result = await devcert.certificateFor('localhost')
      key = result.key
      cert = result.cert
    }
    return https.createServer({key, cert, passphrase}, requestListener)
  }
}

function envPEM(env, value) {
  if (value.includes('-----BEGIN')) {
    return value
  } else {
    if (fs.existsSync(value)) {
      value = fs.readFileSync(value)
    }
    if (!value.includes('-----BEGIN')) {
      throw Error(`${env} must either contain the path to a PEM file or the text of a valid PEM file.`)
    }
  }
}

async function changePortIfNeeded() {
  try {
    if (await isPortTaken(config.port, config.host)) {
      log(`🛑 Port ${config.port} is in use, trying another port...`)
      config.port = 0 // then Node.js will pick one that is available
    }
  } catch (error) {
    if (error.code == 'EACCES') {
      error = Error(`No access to port ${config.port} (port 0 to 1023 require admin-privileges).`)
    }
    error.message = ''+error.message
    throw error
  }
}

async function requestListener(request, response) {
  let urlPath
  try { // so no failure can crash the server
    const url = new URL(request.url, 'http:\\'+request.headers.host)
    urlPath = decodeURIComponent(url.pathname)
    if (!config.ignore_index && urlPath.endsWith('/') && filesServed.has(urlPath+'index.html')) {
      urlPath += 'index.html'
    }
    if (filesServed.has(urlPath)) {
      const filePath = currentDirectory + urlPath
      const stat = fs.statSync(filePath)
      const eTag = stat.mtimeMs.toString(36)
      if (request.headers['if-none-match'] == eTag) {
        response.statusCode = 304 // Not Modified
        response.end() // browser cache is then used
      } else {
        response.statusCode = 200
        response.setHeader('Etag', eTag)
        response.setHeader('Content-Type', mime.getType(urlPath) || 'application/octet-stream')
        if (request.method == 'HEAD') {
          response.end()
        } else {
          let encoder, contentEncoding
          const accept = request.headers['accept-encoding']
          if (config.compression && accept) {
            const accepts = accept.split(', ')
            if (accepts.includes('br')) {
              contentEncoding = 'br'
              encoder = zlib.createBrotliCompress({params: {
                [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT,
                [zlib.constants.BROTLI_PARAM_SIZE_HINT]: stat.size
              }})
            } else if (accepts.includes('gzip')) {
              contentEncoding = 'gzip'
              encoder = zlib.createGzip({level: 9})
            }
          }
          if (contentEncoding) { // if compression
            response.setHeader('Content-Encoding', contentEncoding)
            await pipeline(fs.createReadStream(filePath), encoder, response)
          } else {
            await pipeline(fs.createReadStream(filePath), response)
          }
        }
      }
    } else if (!config.NO_DIRECTORY_LISTING && urlPath.endsWith('/')) {
      directoryListing(urlPath, response)
    } else {
      response.statusCode = 404
      response.end()
    }
    log(`${getClock()} ${isPublic ? request.socket.remoteAddress : '127.0.0.1'} ${response.statusCode} ${request.method} ${decodeURIComponent(request.url)}`)
  } catch (error) {
    response.statusCode = 500
    response.setHeader('Content-Type', 'text/html')
    response.end(''+error)
    log(`${getClock()} ${isPublic ? request.socket.remoteAddress : '127.0.0.1'} ${response.statusCode} ${request.method} ${decodeURIComponent(request.url)} (${error})`)
  }
}

function isPortTaken(port, host) {
  return new Promise((resolve, reject) => {
    const dummyServer = net.createServer()
    .once('error', error => {
      error.code == 'EADDRINUSE' ? resolve(true) : reject(error)
    })
    .once('listening', () => {
      dummyServer.close(() => resolve(false))
    })
    .listen(port, host)
  })
}

function getClock() {
  const date = new Date()
  const hours = date.getHours().toString().padStart(2,'0')
  const minutes = date.getMinutes().toString().padStart(2,'0')
  const seconds = date.getSeconds().toString().padStart(2,'0')
  return `${hours}:${minutes}:${seconds}`
}

async function createRedirectServer(address) {
  let notAvailable
  try {
    notAvailable = await isPortTaken(config.redirect, config.host)
  } catch {
    notAvailable = true
  }
  if (notAvailable) {
    log(`⚠️ Setting up a HTTP to HTTPS redirect server on port ${config.redirect} failed.`)
  } else { // setup a redirect server
    log(`🔀 Setting up a HTTP to HTTPS redirect server on port ${config.redirect}.`)
    http.createServer((request, response) => {
      const newLocation = `https://${address}:${server.address().port}${request.url}`
      response.statusCode = 301 // Moved Permanently
      response.setHeader('Location', newLocation)
      response.end()
      log(`${getClock()} ${isPublic ? request.socket.remoteAddress : '127.0.0.1'} Request to port ${config.redirect} (HTTP) redirected to: ${newLocation}`)
    }).listen(config.redirect, config.host)
  }
}

/** Return `undefined` if not set, else a number. */
function envNumber(value) {
  if (typeof value == 'string') {
    return Number(value)
  }
  return undefined
}

function envSwitch(value) {
  if (typeof value == 'string') {
    switch (value.toLowerCase()) {
      case 'true': case '1':
        return true
    }
  }
  return undefined
}

function getListeningAddresses(host) {
  let familyFilter
  switch (host) {
    case '0.0.0.0': familyFilter = ['IPv4']; break
    case '::': case '[::]': familyFilter = ['IPv4', 'IPv6']; break
    default: return [host]
  }
  const IPs = []
  for (const networkInterface of Object.values(os.networkInterfaces())) {
    for (const {address, family, internal, scopeid} of networkInterface) {
      const IPv6 = (family == 'IPv6')
      if (IPv6 && scopeid != 0) continue
      if (internal || !familyFilter.includes(family)) continue
      IPs.push(IPv6 ? `[${address}]` : address)
    }
  }
  return IPs
}

function directoryListing(urlPath, response) {
  response.statusCode = 200
  response.setHeader('Content-Type', 'text/html; charset=utf-8')
  const subDirLevel = urlPath.split('/').length
  const files = new Set()
  const directories = new Set()
  for (const filePath of filesServed.keys()) {
    const fileSubDirLevel = filePath.split('/').length
    if (filePath.startsWith(urlPath)) {
      if (fileSubDirLevel == subDirLevel) {
        files.add(filePath.split('/')[subDirLevel-1])
      } else if (fileSubDirLevel >= subDirLevel) {
        directories.add(filePath.split('/')[subDirLevel-1]+'/')
      }
    }
  }
  let html = `<h1>Directory listing for: ${urlPath}</h1>\n`
  html += '<nav><ul>\n'
  if (urlPath != '/') {
    html += `<li>🔙<a href="..">[parent directory]</a></li>\n`
  }
  for (const dir of directories) {
    html += `<li>📁<a href="${urlPath+dir}">${dir}</a></li>\n`
  }
  for (const dir of files) {
    html += `<li>🗒️<a href="${urlPath+dir}">${dir}</a></li>\n`
  }
  html += '</ul></nav>\n'
  response.end(html)
}
