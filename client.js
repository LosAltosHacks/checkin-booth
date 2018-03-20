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
        keys: ["firstName", "lastName"]
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
      code: ""
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

/*
let AttendeeCounts = {
  view: () => {
    let checkedInCount = People.peopleList.reduce((a, b) => a + (b.checkedIn ? 1 : 0), 0);
    let signedCount = People.peopleList.reduce((a, b) => a + (b.waiver ? 1 : 0), 0);
    return m(
      "div",
      `${checkedInCount}/${People.peopleList.length} people checked in`,
      m("br"),
      `${signedCount}/${People.peopleList.length} waivers signed`
    );
  }
};
*/

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
        "#people-panel",
        m("div", m(PersonPicker), m(ShowCheckedInButton)),
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
es.addEventListener("ping", () => {
  People.loadPeople();
});

m.mount(document.body, Dashboard);
