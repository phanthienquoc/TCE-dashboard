# WF-04 npm cache fix

WF-04 uses Node 24 without npm dependency caching because the repository does not currently contain an npm lockfile. The workflow still installs dependencies with `npm ci` and builds the web app with Nx.
