# xcNav
PPG flight computer

# Setup Env
`sudo apt install npm` // if setting up env for first time
`npm run setup`

# Run lint:
`npm run lint`

# Compile:
`npm run compile`

Everything gets compiled into `./dist` directory.
All required assets are also copied there.

Default compilation mode is `development` which will
also make nearly all the webpack resources available
in browser debug window. This config should be changed
for production web hosting.
