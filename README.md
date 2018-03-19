# Check-In Booth
Check people into your event and print their name badge.

## Foolish assumptions
* You are using a DYMO LabelWriter printer to print badges
* You are printing on 2.25in x 1.25in labels
* You have DYMO Label software installed on macOS (tested with Label v8.7.0.181 on macOS 10.12)
* Your printing computer has the "DIN" font installed on it
* Your Airtable schema matches what `app.js` is expecting
* You think self-signed certificates are a suitable form of security over the local network

## Getting started
1. Install DYMO Label and set up your label printer
2. `npm install`
3. Acquire Airtable, put credentials in `config.json` (see `config.example.json`).
4. Generate self-signed certificates by running `./scripts/gen-https.sh` (you may need to modify the location of `openssl.cnf`)
5. Build the client's `bundle.js` with `browserify`. (Hint: `npm start` will run `watchify` to do it for you.)
6. `node app.js`

You're now ready to check in people and print name badges. Go get 'em, tiger.
