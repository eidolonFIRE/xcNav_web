# xcNav
PPG flight computer

## Setup environment for the first time
`sudo apt install npm`

## Init repo

### Server (backend)
`cd server`
`npm run setup`
`npm run compile`
`npm run start`   // run the server (localhost:3000)

### Client (webapp)
`cd client`
`npm run setup`
`npm run start`   // Launches live reloaded development server at http://127.0.0.1:8000/


Everything gets compiled into `./client/dist` and `./server/dist` directories.
All required assets are also copied there.

Default compilation mode is `development` which will
also make nearly all the webpack resources available
in browser debug window.
