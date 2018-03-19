const airtable = require("airtable");
const bodyParser = require("body-parser");
const child_process = require("child_process");
const express = require("express");
const fs = require("fs");
const helmet = require("helmet");
const https = require("https");
const path = require("path");
const queue = require("queue");
const SSE = require("sse");

const config = require("./config.json");
const base = new airtable({ apiKey: config.apiKey }).base(config.base);

const app = express();

app.use(bodyParser.json());
app.use(helmet());

let attendeeList = [];
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

let loadAttendees = () => {
  let newAttendeeList = [];
  let trim = str => (str || "").trim();

  base("Attendees")
    .select({
      fields: [
        "First Name",
        "Last Name",
        "High School",
        "Grade",
        "Parent Packet",
        "Checked In",
        "Code"
      ],
      filterByFormula: "NOT({Code} = 'DEVELOPER_CHECKIN_LIST')"
    })
    .eachPage(
      (records, fetchNextPage) => {
        newAttendeeList = newAttendeeList.concat(
          records.map(r => ({
            id: r.id,
            firstName: trim(r.get("First Name")),
            lastName: trim(r.get("Last Name")),
            school: trim(r.get("High School")),
            grade: r.get("Grade"),
            parentPacket: !!r.get("Parent Packet"),
            checkedIn: !!r.get("Checked In"),
            code: r.get("Code").text
          }))
        );
        fetchNextPage();
      },
      err => {
        if (err) {
          console.error(err);
          return;
        } else {
          attendeeList = newAttendeeList;
          log(`Loaded ${attendeeList.length} attendees`);
        }
      }
    );
};

app.use(express.static(path.join(__dirname, "public")));
app.get("/normalize.css", (req, res) => {
  res.sendFile(
    path.join(__dirname, "node_modules", "normalize.css", "normalize.css")
  );
});
app.get("/hint.css", (req, res) => {
  res.sendFile(
    path.join(__dirname, "node_modules", "hint.css", "hint.min.css")
  );
});

app.get("/attendees", (req, res) => {
  res.json(attendeeList);
});
app.post("/print", (req, res) => {
  printQueue.push(cb => {
    let nameRegex = /[^A-Za-z \-]/g;
    let firstName = req.body.firstName.replace(nameRegex, "");
    let lastName = req.body.lastName.replace(nameRegex, "");

    // Spread out print jobs just in case DYMO Label chokes on simultaneous jobs
    setTimeout(() => {
      log(`Printing '${firstName}' '${lastName}'`);
      try {
        child_process.execSync(
          `osascript printBadge.applescript '${firstName}' '${lastName}' '${
            req.body.code
          }'`,
          {
            cwd: path.join(__dirname, "scripts")
          }
        );
      } catch (err) {
        console.error(`Failed to print '${firstName}' '${lastName}'`, err);
      }

      base("Attendees").update(
        req.body.id,
        {
          "Checked In": true
        },
        (err, _) => {
          if (err) {
            console.error(
              `Failed to check in ${firstName} ${lastName} (id: ${
                req.body.id
              }) on Airtable`,
              err
            );
          }
          attendeeList.find(
            attendee => attendee.id == req.body.id
          ).checkedIn = true;
          pingSub.ping();
        }
      );

      cb();
    }, 2000);
  });
  res.send("");
});

loadAttendees();
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

server.listen(8080, () => log("Server is running"));
printQueue.start(err => {
  if (err) console.error(err);
});
