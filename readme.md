
# jlc-dev-serve

A simple and efficient HTTP/S server for serving static files, meant to be used during development (with sane defaults).

> In my other HTTP-server project I wanted to include "the whole kitchen sink" and hence I never really had anything **stable** to release.

In this project I'll try keep it **simple** and only include the most needed features we need for local development (e.g. no minifying of files).

## Features

* HTTPS server with automatic certificates for development ([devcert](https://www.npmjs.com/package/devcert)).
* Directory watcher ([chokidar](https://www.npmjs.com/package/chokidar)) with [LiveReload](https://chromewebstore.google.com/detail/jnihajbhpnppcggbcgedagnkighmdlei) support.
* Etag support (utilizes browser cache when possible).
* Compression support (gzip and brotli).
* Directory listing (can be turned off).
* MIME types support through [mime](https://www.npmjs.com/package/mime).
* Very small amount of code written so anyone can understand it!

## Usage

```bash
npx jlc-dev-serve
```

> (with [npx](https://docs.npmjs.com/cli/v8/commands/npx) it doesn't have to be installed first)

Will serve the files in the current directory.

### Note

It seems that when using `npx` you'll get the warning ```The `punycode` module is deprecated```. I have a script to fix the dependency which cause this warning, but that script is only executed on the installation of my package.

Hence to get rid of that warning just install my package globally like this:
```bash
npm install -g jlc-dev-serve
```

## Configuration

It can be configured by setting environment variables. E.g. like this:
```bash
HTTP=1 HOST=0.0.0.0 PORT=1337 npx jlc-dev-serve
```

Environment variables (all are optional):
| Variable | Description |
| --- | --- |
| HTTP | Set (to `1` or `true`) to use HTTP instead of HTTPS. |
| CERT | The certificate (PEM format) to use with the HTTPS server or a path to it. |
| KEY |  The private key (PEM format) to use with the HTTPS server or a path to it. |
| PASS | The passphrase (if KEY needs one). |
| PORT | The port to use (defaults to 8080 for HTTP and 4433 for HTTPS). |
| HOST | Defaults to localhost. Use `0.0.0.0` to accept any IPv4 connection or `::` to accept any IPv6 and IPv4 connection (on most systems). |
| PUBLIC | A shortcut to setting the host to `::`. |
| REDIRECT | Redirect any HTTP connections to this port to the HTTPS server. |
| COMPRESSION | Whether to support BR or GZIP compression. |
| IGNORE_INDEX | Ignore any `index.html` file when browsing `path/`. |
| NO_DIRECTORY_LISTING | When browsing `path/` do NOT list its contents. |
| NO_LIVE_RELOAD | Set to NOT start the LiveReload server. |

## The End

That's it, there's really not much more to it!

If you like it, then please [support me](https://github.com/sponsors/JoakimCh) so I don't lose my house! 🏠


> Your soul or higher self is just a certain perspective higher up than your lower self; meaning it can see, feel and experience everything that your lower self is experiencing.
> 
> Basically we have a tree-like structure of branched perspectives where God is the trunk!

❤️
