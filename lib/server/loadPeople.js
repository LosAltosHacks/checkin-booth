let trim = str => (str || "").trim();

let loadAttendeesMentors = (base, callback) => {
  let list = [];

  base("AttendeesMentors")
    .select({
      fields: [
        "First Name",
        "Last Name",
        "DocuSign",
        "Checked In",
        "Code",
        "Type",
        "Email",
        "High School",
        "Grade",
        "Waitlisted"
      ],
      filterByFormula: "NOT({Code} = 'DEVELOPER_CHECKIN_LIST')"
    })
    .eachPage(
      (records, fetchNextPage) => {
        list = list.concat(
          records.map(r => {
            let firstName = trim(r.get("First Name"));
            let lastName = trim(r.get("Last Name"));

            return {
              id: r.id,
              firstName: firstName,
              lastName: lastName,
              fullName: `${firstName} ${lastName}`,
              docuSign: !!r.get("DocuSign"),
              checkedIn: !!r.get("Checked In"),
              code: r.get("Code").text,
              type: r.get("Type"),
              email: r.get("Email"),
              highSchool: r.get("High School"),
              grade: r.get("Grade"),
              waitlisted: r.get("Waitlisted")
            };
          })
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
      fields: ["First Name", "Last Name", "DocuSign", "Checked In", "Email"]
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
            type: "Chaperone",
            email: r.get("Email")
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
