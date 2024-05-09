/*
LiveReload websites:
http://livereload.com
https://github.com/livereload

LiveReload Chrome extension:
https://chrome.google.com/webstore/detail/livereload/jnihajbhpnppcggbcgedagnkighmdlei

Protocol documentation:
http://livereload.com/api/protocol/
https://github.com/livereload/livereload-site/blob/master/livereload.com/_articles/api/protocol.md
https://github.com/livereload/livereload-js/blob/master/src/livereload.js#L134
https://github.com/livereload/livereload-js/blob/master/src/reloader.js#L156
https://github.com/livereload/livereload-protocol/blob/master/lib/parser.coffee

Alternative extension:
This one will try to connect to the actual host (parsed from the URL) rather than 127.0.0.1...
https://github.com/bigwave/livereload-extensions
https://chrome.google.com/webstore/detail/remotelivereload/jlppknnillhjgiengoigajegdpieppei
*/

import * as fs from 'node:fs'
import * as path from 'node:path'
import * as http from 'node:http'
import {fileURLToPath} from 'node:url';
import {WebSocket} from 'jlc-websocket'
const log = console.log

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url))
const clientScriptPath = path.join(moduleDirectory, 'liveReloadClient.min.js')
let server

export function start() {
  if (!server) {
    server = http.createServer((request, response) => {
      if (request.url.startsWith('/livereload.js')) {
        if (request.headers['if-none-match'] == 'livereload') {
          response.statusCode = 304 // Not Modified
          return response.end() // browser cache is then used
        }
        response.statusCode = 200
        response.setHeader('Etag', 'livereload')
        response.setHeader('Content-Type', 'text/javascript')
        if (request.method == 'HEAD') {
          return response.end()
        }
        fs.createReadStream(clientScriptPath).pipe(response)
      } else {
        response.statusCode = 404
        response.end()
      }
    })
    .on('upgrade', (request, response) => {
      if (request.url == '/livereload') {
        wsConnectionHandler(new WebSocket(request))
      } else {
        response.statusCode = 404
        response.end()
      }
    })
  }
  server.listen(35729)
}

export function reportChange(path) {
  LiveReloadClient.requestReload(path)
}

export function stop() {
  server.closeAllConnections()
  server.close()
}

function wsConnectionHandler(webSocket) {
  webSocket.once('open', () => {
    new LiveReloadClient(webSocket)
  })
  // (handle errors to avoid them being thrown)
  webSocket.on('error', error => {
    log('⚠️ LiveReload WebSocket error event:', error)
  })
}

class LiveReloadClient {
  #webSocket; #firstOrigin; #lastOrigin

  static #activeClients = new Set()

  static requestReload(path) {
    for (const client of LiveReloadClient.#activeClients) {
      client.sendReloadRequest(path)
    }
  }

  constructor(webSocket) {
    webSocket.jsonMode = true
    webSocket.on('message', this.#messageHandler.bind(this))
    this.#webSocket = webSocket
  }

  sendReloadRequest(path) {
    if (this.#lastOrigin && this.#lastOrigin != this.#firstOrigin) {
      return // if navigated away to some other host
    }
    this.#webSocket.send({
      command: 'reload',
      path,
      liveCSS: true, liveImg: true
    })
  }

  #messageHandler({data}) {
    if (!data.command) { // close connections to anything other than a LiveReload client
      return this.#webSocket.close()
    }
    /*
    On first connection two WebSockets connect, one with a "connection-check" protocol and the other the LiveReload protocol.
    On any navigation/reload the LiveReload protocol closes and connects again (since it's injected as a script into the page).
    */
    switch (data.command) {
      case 'hello': // (protocol negotiation on new connection)
        if (!LiveReloadClient.#activeClients.has(this)) {
          if (!data.protocols || !Array.isArray(data.protocols)) {
            return this.#webSocket.close() // on invalid handshake
          }
          for (const protocol of data.protocols) {
            if (protocol == 'http://livereload.com/protocols/connection-check-1') {
              this.#webSocket.send({
                command: 'hello',
                protocols: [protocol], // the one we picked
              })
              return // leave it open, but do not send reload requests to it
            }
            if (protocol == 'http://livereload.com/protocols/official-7') {
              this.#webSocket.send({
                command: 'hello',
                protocols: [protocol], // the one we picked
              })
              // if we're sure that this is a LiveReload client then register it
              LiveReloadClient.#activeClients.add(this)
              this.#webSocket.once('close', () => {
                LiveReloadClient.#activeClients.delete(this)
              })
              return
            }
          }
          // if no protocol negotiated
          this.#webSocket.close()
        }
      break
      case 'info': // url changes
        if (!data.url) return this.#webSocket.close() // invalid protocol
        const url = new URL(data.url)
        if (!this.#firstOrigin) {
          this.#firstOrigin = url.origin
        } else {
          this.#lastOrigin = url.origin
        }
      break
    }
  }
}
