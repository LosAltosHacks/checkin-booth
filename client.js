const Fuse = require("fuse.js");
const m = require("mithril");

let People = {
  showCheckedIn: false,
  searchText: "",
  searchPosition: 0,
  searchResults: [],
  isPersonSelected: false,
  selectedPerson: {},
  peopleList: [],

  loadPeople() {
    return m.request("/people").then(result => {
      this.peopleList = result.sort(
        (a, b) => `${a.firstName} ${a.lastName}` > `${b.firstName} ${b.lastName}`
      );
      this.fuse = new Fuse(this.peopleList, {
        shouldSort: true,
        threshold: 0.6,
        location: 0,
        distance: 100,
        maxPatternLength: 32,
        minMatchCharLength: 1,
        keys: ["fullName"]
      });
    });
  },

  search() {
    if (this.fuse == undefined || this.searchText.length == 0) {
      this.searchResults = this.peopleList
        .filter(person => person.checkedIn == this.showCheckedIn)
        .slice(0, 15);
    } else if (this.fuse != undefined) {
      this.searchResults = this.fuse
        .search(People.searchText)
        .filter(person => person.checkedIn == this.showCheckedIn)
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

  selectPerson(person) {
    this.isPersonSelected = true;
    this.selectedPerson = Object.create(person);
  },
  clearSelectedPerson() {
    this.isPersonSelected = false;
    this.selectedPerson = {
      id: "",
      firstName: "",
      lastName: "",
      docuSign: false,
      checkedIn: false,
      code: "",
      type: "",
      waitlisted: undefined
    };
  },
  requiresDocuments() {
    if (this.isPersonSelected) {
      switch (this.selectedPerson.type) {
        case "Attendee":
        case "Mentor":
        case "Chaperone":
          return true;
        case "Sponsor":
        case "Judge":
          return false;
        default:
          console.error(`Invalid person type: ${this.selectedPerson.type}`);
          return false;
      }
    } else {
      return false;
    }
  }
};

let PersonPicker = {
  oninit: () => People.loadPeople().then(() => People.search()),
  view: () =>
    m(
      "div",
      m("input#people-search", {
        autofocus: true,
        placeholder: "Search for people...",
        value: People.searchText,
        oninput: m.withAttr("value", value => {
          People.searchText = value;
          People.clearSelectedPerson();
          People.search();
        }),
        onkeydown: e => {
          if (e.keyCode == 38) {
            People.updateSearchPosition(-1);
          } else if (e.keyCode == 40) {
            People.updateSearchPosition(1);
          } else if (e.keyCode == 13) {
            People.selectPerson(People.searchResults[People.searchPosition]);
            e.preventDefault();
            document.getElementById("first-name").focus();
          }
        }
      }),
      m(
        "#people-list",
        People.searchResults.map((person, i) =>
          m(
            People.searchPosition == i
              ? ".person-selected"
              : person.checkedIn ? ".checked-in" : "div",
            {
              onclick: e => {
                People.searchPosition = i;
                People.selectPerson(People.searchResults[People.searchPosition]);
                e.preventDefault();
                document.getElementById("first-name").focus();
              }
            },
            m("div.type-indicator." + person.type.toLowerCase()),
            `${person.firstName} ${person.lastName}`
          )
        )
      )
    )
};

let PersonForm = {
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
              id: People.selectedPerson.id,
              firstName: People.selectedPerson.firstName,
              lastName: People.selectedPerson.lastName,
              code: People.selectedPerson.code,
              type: People.selectedPerson.type
            }
          });
          People.peopleList.find(person => person.id == People.selectedPerson.id).checkedIn = true;
          People.clearSelectedPerson();
          People.searchText = "";
          document.getElementById("people-search").focus();
          People.search();
        }
      },
      m(
        "fieldset",
        m("label", "Name"),
        m("input#first-name", {
          required: People.isPersonSelected,
          maxlength: 25,
          value: People.selectedPerson.firstName,
          onchange: m.withAttr("value", value => (People.selectedPerson.firstName = value))
        }),
        m("input", {
          required: People.isPersonSelected,
          maxlength: 25,
          value: People.selectedPerson.lastName,
          onchange: m.withAttr("value", value => (People.selectedPerson.lastName = value))
        })
      ),
      m(
        "fieldset",
        m("label", "Type"),
        m("input", {
          disabled: true,
          value: People.selectedPerson.type
        })
      ),
      m(
        People.selectedPerson.email == undefined ? ".hidden" : "fieldset",
        m("label", "Email"),
        m("input", {
          disabled: true,
          value: People.selectedPerson.email
        })
      ),
      m(
        People.selectedPerson.grade == undefined ? ".hidden" : "fieldset",
        m(
          ".form-group",
          m("label", "High School"),
          m("input", {
            disabled: true,
            value: People.selectedPerson.highSchool
          })
        ),
        m(
          ".form-group",
          m("label", "Grade"),
          m("input", {
            disabled: true,
            value: People.selectedPerson.grade
          })
        )
      ),
      m(
        People.requiresDocuments() ? "fieldset" : ".hidden",
        m(
          "label",
          "Documents signed",
          m("input[type=checkbox][disabled]", {
            checked: People.selectedPerson.docuSign
          })
        )
      ),
      m(
        People.selectedPerson.waitlisted == undefined ? ".hidden" : "fieldset",
        m(
          "label",
          "Waitlisted",
          m("input[type=checkbox][disabled]", {
            checked: People.selectedPerson.waitlisted
          })
        )
      ),
      m(
        "button",
        People.isPersonSelected && People.requiresDocuments() && !People.selectedPerson.docuSign
          ? {
              class: "hint--bottom hint--error",
              "aria-label": "Documents must be signed first",
              disabled: true
            }
          : {
              disabled: !People.isPersonSelected
            },
        People.showCheckedIn ? "Reprint badge" : "Check in and print badge"
      )
    )
};

let PeopleCounts = {
  view: () => {
    let typeToIndex = {
      Attendee: 0,
      Mentor: 1,
      Chaperone: 2,
      Sponsor: 3,
      Judge: 4
    };
    let counts = People.peopleList.reduce(
      (a, b) => {
        a[typeToIndex[b.type]]++;
        return a;
      },
      [0, 0, 0, 0, 0]
    );

    let checkedInCounts = People.peopleList.reduce(
      (a, b) => {
        if (b.checkedIn) a[typeToIndex[b.type]]++;
        return a;
      },
      [0, 0, 0, 0, 0]
    );

    let signPeople = People.peopleList.filter(
      p => p.type == "Attendee" || p.type == "Mentor" || p.type == "Chaperone"
    );
    let signedCount = signPeople.reduce((a, b) => a + (b.docuSign ? 1 : 0), 0);

    return m(
      "div",
      Object.keys(typeToIndex)
        .map(key => {
          let index = typeToIndex[key];
          return m(
            "div",
            `${checkedInCounts[index]}/${counts[index]} ${key.toLowerCase()}s checked in`
          );
        })
        .concat(m("div", `${signedCount}/${signPeople.length} documents signed`))
    );
  }
};

let ShowCheckedInButton = {
  view: () =>
    m(
      "#show-checked-in",
      "Show checked-in people",
      m("input[type=checkbox]", {
        onchange: m.withAttr("checked", checked => {
          People.showCheckedIn = checked;
          People.search();
          People.clearSelectedPerson();
          document.getElementById("people-search").select();
        }),
        checked: People.showCheckedIn
      })
    )
};

let Dashboard = {
  view: () =>
    m(
      "main",
      m(
        "#logout-panel",
        m(
          "button",
          {
            onclick: _ => (location.href = "/logout")
          },
          "Log Out"
        )
      ),
      m(
        "#people-panel",
        m("div", m(PersonPicker), m(PeopleCounts), m(ShowCheckedInButton)),
        m(PersonForm)
      )
    )
};

document.body.addEventListener("keydown", e => {
  if (e.keyCode == 27) {
    document.getElementById("people-search").select();
  }
});

let es = new EventSource("/sse");
es.addEventListener("ping", () =>
  People.loadPeople().then(_ => {
    People.search();
    m.redraw();
  })
);

m.mount(document.body, Dashboard);
