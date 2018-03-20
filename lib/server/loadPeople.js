let trim = str => (str || "").trim();

let loadAttendeesMentors = (base, callback) => {
  let list = [];

  base("AttendeesMentors")
    .select({
      fields: ["First Name", "Last Name", "Parent Packet", "Checked In", "Code", "Type"],
      filterByFormula: "NOT({Code} = 'DEVELOPER_CHECKIN_LIST')"
    })
    .eachPage(
      (records, fetchNextPage) => {
        list = list.concat(
          records.map(r => ({
            id: r.id,
            firstName: trim(r.get("First Name")),
            lastName: trim(r.get("Last Name")),
            parentPacket: !!r.get("Parent Packet"),
            checkedIn: !!r.get("Checked In"),
            code: r.get("Code").text,
            type: r.get("Type")
          }))
        );
        fetchNextPage();
      },
      err => {
        if (err) {
          console.error(err);
        } else {
          callback(list);
        }
      }
    );
};

let loadChaperones = (base, callback) => {
  let list = [];

  base("Chaperones")
    .select({
      fields: ["First Name", "Last Name", "DocuSign", "Checked In"]
    })
    .eachPage(
      (records, fetchNextPage) => {
        list = list.concat(
          records.map(r => ({
            id: r.id,
            firstName: trim(r.get("First Name")),
            lastName: trim(r.get("Last Name")),
            docuSign: !!r.get("DocuSign"),
            checkedIn: !!r.get("Checked In"),
            type: "Chaperone"
          }))
        );
        fetchNextPage();
      },
      err => {
        if (err) {
          console.error(err);
        } else {
          callback(list);
        }
      }
    );
};

let loadSponsorsJudges = (base, callback) => {
  let list = [];

  base("SponsorsJudges")
    .select({
      fields: ["First Name", "Last Name", "Checked In", "Type"]
    })
    .eachPage(
      (records, fetchNextPage) => {
        list = list.concat(
          records.map(r => ({
            id: r.id,
            firstName: trim(r.get("First Name")),
            lastName: trim(r.get("Last Name")),
            checkedIn: !!r.get("Checked In"),
            type: r.get("Type")
          }))
        );
        fetchNextPage();
      },
      err => {
        if (err) {
          console.error(err);
        } else {
          callback(list);
        }
      }
    );
};

let loadPeople = (base, callback) => {
  loadAttendeesMentors(base, attendeesMentors => {
    loadChaperones(base, chaperones => {
      loadSponsorsJudges(base, sponsorsJudges => {
        callback(attendeesMentors.concat(chaperones, sponsorsJudges));
      });
    });
  });
};

module.exports = loadPeople;
