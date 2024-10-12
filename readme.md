
# jlc-dev-serve

A simple and efficient HTTP/S server for serving static files, meant to be used during development (with sane defaults).

> In my other HTTP-server project I wanted to include "the whole kitchen sink" and hence I never really had anything **stable** to release.

In this project I'll try keep it **simple** and only include the most needed features we need for local development (e.g. no minifying of files).

## Features

* HTTPS server with automatic certificates for development ([devcert](https://www.npmjs.com/package/devcert)).
* Directory watcher ([chokidar](https://www.npmjs.com/package/chokidar)) with [LiveReload](https://chromewebstore.google.com/detail/jnihajbhpnppcggbcgedagnkighmdlei) support.
* Etag support (utilizes browser cache when possible).
* Compression support (gzip and Brotli).
* Directory listing (can be turned off).
* Bootstrapping index.js files.
* MIME types support through [mime](https://www.npmjs.com/package/mime).
* Very small amount of code written so anyone can understand it!

## Usage

```bash
npx jlc-dev-serve
```

> (with [npx](https://docs.npmjs.com/cli/v8/commands/npx) it doesn't have to be installed first)

Will serve the files in the current directory.

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
| PREFIX | Add a prefix which URLs must begin with to access the served files. |
| REDIRECT | Redirect any HTTP connections to this port to the HTTPS server. |
| COMPRESSION | Whether to support "Brotli" and "gzip" compression. |
| IGNORE_INDEX | Ignore any `index.html` file when browsing `path/`. |
| JS_BOOTSTRAP | Can be set to "bootstrap" `index.js` and `index.mjs` files by using "virtual HTML indexes" which just runs them. It can also define a list of scripts to execute before running them. Documentation [here](#documentation-of-js_bootstrap). |
| NO_DIRECTORY_LISTING | When browsing `path/` do NOT list its contents. |
| NO_LIVE_RELOAD | Set to NOT start the LiveReload server. |

## Documentation of JS_BOOTSTRAP

The `JS_BOOTSTRAP` environment variable can be set to "bootstrap" `index.js` and `index.mjs` files by using "virtual HTML indexes" which just runs them. It can also define a list of scripts to execute before running them.

Setting `JS_BOOTSTRAP=1` or to `true` will enable this feature and depending on their `.js` or `.mjs` extension they will run as normal scripts or scripts with `type="module"` set. But setting it to `JS_BOOTSTRAP=module` will override this and run them all as modules.

You can even define a static list of scripts to run before them and also define whether each of these should run as normal scripts or modules as well.

E.g. like this:
```
JS_BOOTSTRAP=module|http://domain.com/script_x.js|/and_my_own_script_to_run_before_any_indexjs.js
```
Here the first script is loaded as a module while the second one isn't, because it wasn't preceded by `module|`.

Changing it to:
```
JS_BOOTSTRAP=module|http://domain.com/script_x.js|/and_my_own_script_to_run_before_any_indexjs.js|module
```
Will function the same as `JS_BOOTSTRAP=module` does and load your `index.js` as modules.

## The End

That's it, there's really not much more to it!

If you like it, then please [support me](https://github.com/sponsors/JoakimCh) so I don't lose my house! 🏠


> Your soul or higher self is just a certain perspective higher up than your lower self; meaning it can see, feel and experience everything that your lower self is experiencing.
> 
> Basically we have a tree-like structure of branched perspectives where God is the trunk!

❤️
