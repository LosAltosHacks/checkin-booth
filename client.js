const Fuse = require("fuse.js");
const m = require("mithril");

let Attendee = {
  showCheckedIn: false,
  searchText: "",
  searchPosition: 0,
  searchResults: [],
  isAttendeeSelected: false,
  selectedAttendee: {},
  attendeeList: [],

  loadAttendees() {
    return m.request("/attendees").then(result => {
      this.attendeeList = result.sort(
        (a, b) =>
          `${a.firstName} ${a.lastName}` > `${b.firstName} ${b.lastName}`
      );
      this.fuse = new Fuse(this.attendeeList, {
        shouldSort: true,
        threshold: 0.6,
        location: 0,
        distance: 100,
        maxPatternLength: 32,
        minMatchCharLength: 1,
        keys: ["firstName", "lastName"]
      });
    });
  },

  search() {
    if (this.fuse == undefined || this.searchText.length == 0) {
      this.searchResults = this.attendeeList
        .filter(attendee => attendee.checkedIn == this.showCheckedIn)
        .slice(0, 15);
    } else if (this.fuse != undefined) {
      this.searchResults = this.fuse
        .search(Attendee.searchText)
        .filter(attendee => attendee.checkedIn == this.showCheckedIn)
        .slice(0, 15);
    }
    this.updateSearchPosition(0);
  },
  updateSearchPosition(offset) {
    this.searchPosition = Math.max(
      0,
      Math.min(this.searchResults.length - 1, this.searchPosition + offset)
    );
  },

  selectAttendee(attendee) {
    this.isAttendeeSelected = true;
    this.selectedAttendee = Object.create(attendee);
  },
  clearSelectedAttendee() {
    this.isAttendeeSelected = false;
    this.selectedAttendee = {
      id: "",
      firstName: "",
      lastName: "",
      school: "",
      grade: "",
      parentPacket: false,
      checkedIn: false,
      code: ""
    };
  }
};

let AttendeePicker = {
  oninit: () => Attendee.loadAttendees().then(() => Attendee.search()),
  view: () =>
    m(
      "div",
      m("input#attendee-search", {
        autofocus: true,
        placeholder: "Search for attendees...",
        value: Attendee.searchText,
        oninput: m.withAttr("value", value => {
          Attendee.searchText = value;
          Attendee.clearSelectedAttendee();
          Attendee.search();
        }),
        onkeydown: e => {
          if (e.keyCode == 38) {
            Attendee.updateSearchPosition(-1);
          } else if (e.keyCode == 40) {
            Attendee.updateSearchPosition(1);
          } else if (e.keyCode == 13) {
            Attendee.selectAttendee(
              Attendee.searchResults[Attendee.searchPosition]
            );
            e.preventDefault();
            document.getElementById("first-name").focus();
          }
        }
      }),
      m(
        "#attendee-list",
        Attendee.searchResults.map((attendee, i) =>
          m(
            Attendee.searchPosition == i
              ? ".attendee-selected"
              : attendee.checkedIn ? ".checked-in" : "div",
            {
              onclick: e => {
                Attendee.searchPosition = i;
                Attendee.selectAttendee(
                  Attendee.searchResults[Attendee.searchPosition]
                );
                e.preventDefault();
                document.getElementById("first-name").focus();
              }
            },
            `${attendee.firstName} ${attendee.lastName}`
          )
        )
      )
    )
};

let AttendeeForm = {
  view: () =>
    m(
      "form",
      {
        onsubmit: e => {
          e.preventDefault();
          m.request({
            method: "POST",
            url: "/print",
            data: {
              id: Attendee.selectedAttendee.id,
              firstName: Attendee.selectedAttendee.firstName.trim(),
              lastName: Attendee.selectedAttendee.lastName.trim(),
              code: Attendee.selectedAttendee.code
            }
          });
          Attendee.attendeeList.find(
            attendee => attendee.code == Attendee.selectedAttendee.code
          ).checkedIn = true;
          Attendee.clearSelectedAttendee();
          Attendee.searchText = "";
          document.getElementById("attendee-search").focus();
          Attendee.search();
        }
      },
      m(
        "fieldset",
        m("label", "Name"),
        m("input#first-name", {
          required: Attendee.isAttendeeSelected,
          value: Attendee.selectedAttendee.firstName,
          onchange: m.withAttr(
            "value",
            value => (Attendee.selectedAttendee.firstName = value)
          )
        }),
        m("input", {
          required: Attendee.isAttendeeSelected,
          value: Attendee.selectedAttendee.lastName,
          onchange: m.withAttr(
            "value",
            value => (Attendee.selectedAttendee.lastName = value)
          )
        })
      ),
      m(
        "fieldset",
        m(
          ".form-group",
          m("label", "School"),
          m("input[disabled]", {
            value: Attendee.selectedAttendee.school
          })
        ),
        m(
          ".form-group",
          m("label", "Grade"),
          m("input[disabled]", {
            value: Attendee.selectedAttendee.grade
          })
        )
      ),
      m(
        "fieldset",
        m(
          "label",
          "Parent Packet signed",
          m("input[type=checkbox][disabled]", {
            checked: Attendee.selectedAttendee.parentPacket
          })
        )
      ),
      m(
        "button",
        Attendee.isAttendeeSelected && !Attendee.selectedAttendee.parentPacket
          ? {
              class: "hint--bottom hint--error",
              "aria-label": "Parent packet must be signed first",
              disabled: true
            }
          : {
              disabled: !Attendee.isAttendeeSelected
            },
        Attendee.showCheckedIn ? "Reprint badge" : "Check in and print badge"
      )
    )
};

let AttendeeCounts = {
  view: () => {
    let checkedInCount = Attendee.attendeeList.reduce(
      (a, b) => a + (b.checkedIn ? 1 : 0),
      0
    );
    let signedCount = Attendee.attendeeList.reduce(
      (a, b) => a + (b.parentPacket ? 1 : 0),
      0
    );
    return m(
      "div",
      `${checkedInCount}/${Attendee.attendeeList.length} attendees checked in`,
      m("br"),
      `${signedCount}/${Attendee.attendeeList.length} parent packets signed`
    );
  }
};

let ShowCheckedInButton = {
  view: () =>
    m(
      "#show-checked-in",
      "Show checked-in attendees",
      m("input[type=checkbox]", {
        onchange: m.withAttr("checked", checked => {
          Attendee.showCheckedIn = checked;
          Attendee.search();
          Attendee.clearSelectedAttendee();
        }),
        checked: Attendee.showCheckedIn
      })
    )
};

let Dashboard = {
  view: () =>
    m(
      "main",
      m(
        "#attendee-panel",
        m("div", m(AttendeePicker), m(AttendeeCounts), m(ShowCheckedInButton)),
        m(AttendeeForm)
      )
    )
};

document.body.addEventListener("keydown", e => {
  if (e.keyCode == 27) {
    document.getElementById("attendee-search").select();
  }
});

let es = new EventSource("/sse");
es.addEventListener("ping", () => {
  Attendee.loadAttendees();
});

m.mount(document.body, Dashboard);
