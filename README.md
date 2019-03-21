# Check-In Booth
Check people into your event and print their name badge.

## Foolish assumptions
* You are using a DYMO LabelWriter printer to print badges
* You are printing on 2.25in x 1.25in labels
* You have DYMO Label software installed on macOS (tested with Label v8.7.0.181 on macOS 10.12)
* Your printing computer has the "DIN Regular" and "DIN Bold" fonts installed on it
* Your Airtable schema matches what `app.js` is expecting
* You think self-signed certificates are a suitable form of security over the local network

## Getting started
1. Install DYMO Label and set up your label printer
2. `npm install`
3. Acquire Airtable. Put your API key and base ID in `config.json` (see `config.example.json`)
4. Fill out the rest of `config.json` with your DocuSign ping endpoint (optional), users, and session secret
5. Generate self-signed certificates by running `./scripts/gen-https.sh` (you may need to modify the location of `openssl.cnf`)
6. Build the client's `bundle.js` with `browserify`. (Hint: `npm start` will run `watchify` to do it for you.)
7. `node app.js`
8. Navigate to `https://localhost:8080` or `https://[some IP address]:8080` on your local network. You can also specify a port on the command line like `PORT=3000 node app.js`
9. Login with your username and password from step 4

You're now ready to check in people and print name badges. Go get 'em, tiger.
