// Caching the DOM elements we'll need for repeated use later
var paginationEl = d3.select("#pagination");
var countEl = d3.select("#count");

var table = d3.select("#ufo-table");
var loader = d3.select("#loader");

// get data from api
var url = "https://jsonblob.com/api/jsonBlob/451dde4c-afeb-11e7-b7f1-cd0d40937bac";

showLoader();

// make the request to get the data for the page, pass it to the init function
d3.json(url, init);

// add event listeners to the pagination element
paginationEl.on("click", changePage);

// keep track of the values of the filters in the sidebar
var filters = {};

// updates our filters object based on the event passed
d3.selectAll(".filter").on("change", function(event) {
  var changedElement = d3.event.target;
  var filterId = changedElement.id;
  var value = changedElement.value.trim();

  if (value) {
    filters[filterId] = value;
  }
  else {
    delete filters[filterId];
  }

  refreshTable();
});

// data is an object containing information and methods that have to do with the dataset
var data = {
  // compare the data in the dataSet to the selected filters, and sets data.filtered equal to an array of the objects which pass the filter
  filter: function() {
    // The filter method goes through each element in the dataSet and returns a new array. Items from the original array which fail the test are not included
    this.filtered = this.dataSet.filter(function(ufoRecord) {
      var matchesFilters = true;

      // loop through filters
      Object.entries(filters).forEach(function(entry) {
        var filterId = entry[0];
        var filterValue = entry[1];

        // if this ufoRecord doesn't match this filter value, flag it
        if (!fuzzyMatches(filterValue, ufoRecord[filterId])) {
          matchesFilters = false;
        }
      });
      // if fuzzyMatches was never false (matched all filters), this will still be true
      return matchesFilters;
    });
  }
};

// compares filter value to value of individual ufoRecord
function fuzzyMatches(search, result) {
  // Trim result to be at most the length of filter value, so that partial matches work, or empty searches match with everything
  var slicedResult = result.slice(0, search.length);

  return search === slicedResult;
}

// if results-per-page changes, reload table for pagination update
countEl.on("change", loadTable);

// page is an object containing methods and information that have to do with paginating the dataSet
var page = {
  currentPage: 1,
  // numPages refers to the total number of pages that should appear in the pagination list based on the size of the data and results per page
  numPages: function() {
    return Math.ceil(data.filtered.length / this.resultsPerPage());
  },
  // resultsPerPage returns the value of the "Results Per Page" dropwdown inside the sidebar
  resultsPerPage: function() {
    return countEl.property("value").trim();
  },
  // getPageSubset returns an array containing the page numbers which should show up on the pagination list
  getPageSubset: function() {
    var counter;
    // If the current page is less than 11, start the counter at 1 as we are on the first page
    if (this.currentPage < 11) {
      counter = 1;
    }
    // If the current page is evenly divisible by 10, start the counter at itself minus 9 (e.g. pagination rows go 11 - 20, 21 - 30 ,etc)
    else if (this.currentPage % 10 === 0) {
      counter = this.currentPage - 9;
    }
    else {
      // Otherwise divide the current page by 10, round down (e.g. 26 becomes 2), then multiply by 10 (becomes 20) and add 1 (starts at 21)
      counter = Math.floor(this.currentPage / 10) * 10 + 1;
    }
    // Create an array to contain the pages numbers to return
    var pageNumbers = [counter];
    counter++;
    // While the current page number is less than the total number of pages and we have less than 10 pages in this set of pageNumbers...
    while (pageNumbers[pageNumbers.length - 1] < this.numPages() && pageNumbers.length < 10) {
      pageNumbers.push(counter);
      counter++;
    }
    // Return the pageNumbers array when complete
    return pageNumbers;
  },
  // paginate returns an array containing only section of the filtered data which should show up on the current page
  paginate: function(array, pageSize, pageNumber) {
    pageNumber--;
    return array.slice(pageNumber * pageSize, (pageNumber + 1) * pageSize);
  }
};

// initialize the page with a specific dataset. calls loadDropdown, loadTable, and appendPagination
function init(dataSet) {
  data.dataSet = dataSet;
  data.filtered = dataSet;

  loadDropdown();
  loadTable();
  appendPagination();
}

function refreshTable() {
  // refreshTable calls data.filter, which updates the data.filtered dataset
  data.filter();

  // loadTable is then called, which reloads the table with the updated and filtered data
  loadTable();

  // appendPagination updates the pagination to match the size of the filtered data
  appendPagination();
}

// dynamically generate the list of options for country and shape in the dropdown filters
function loadDropdown() {
  // dropdownOptions will be used to construct HTML for the country and shape dropdown menus
  // Each possible country and shape option gets a string option tag like the ones below
  var dropdownOptions = {
    country: ["<option default value=''>all</option>"],
    shape: ["<option default value=''>all</option>"]
  };

  // get elements to which we'll be adding values
  var countryDropdown = d3.select("#country");
  var shapeDropdown = d3.select("#shape");

  // optionKeys is an array containing the keys in the dropdownOptions object as strings (['country', 'shape'])
  var optionKeys = Object.keys(dropdownOptions);

  // For each object in the dataSet, also loop through each object in dropdownOptions
  // Create an HTML tag string for a dropdown option containing the each piecedata's country and shape
  for (var i = 0; i < data.dataSet.length; i++) {
    var ufoData = data.dataSet[i];
    for (var j = 0; j < optionKeys.length; j++) {
      var dropdownOption = optionKeys[j];
      var optionHTML = "<option value='" + ufoData[dropdownOption] + "'>" + ufoData[dropdownOption] + "</option>";
      // If the country and shape option is not already inside dropdownOptions.country or dropdownOptions.state, add it to the appropriate array
      if (dropdownOptions[dropdownOption].indexOf(optionHTML) < 0) {
        dropdownOptions[dropdownOption].push(optionHTML);
      }
    }
  }
  // Render the arrays of country and shape HTML option tags to the countryDropdown select box on the page
  countryDropdown.innerHTML = dropdownOptions.country.join("");
  shapeDropdown.innerHTML = dropdownOptions.shape.join("");
}

function changePage(event) {
  // Prevent the default behavior of the anchor tag when clicked
  d3.event.preventDefault();
  // get a reference to the clicked element and triggered the event, then get the href attribute of the anchor tag
  var paginationBtn = d3.event.target;
  var newPageNumber = parseInt(paginationBtn.getAttribute("href"));

  // If newPageNumber is less than 1 OR more than the maximum number of pages available in the dataset, return out of the function early since there is no page to go backwards to forwards to
  if (newPageNumber < 1 || newPageNumber > page.numPages()) {
    return false;
  }
  // Otherwise set page.currentPage to the newPageNumber
  page.currentPage = newPageNumber;
  // If the clicked paginationBtn is one of the arrow buttons...
  if (paginationBtn.className === "page-direction") {
    // Run appendPagination, which completely replaces all the buttons inside the pagination list with new buttons
    appendPagination();
  }
  else {
    // Otherwise just update the CSS of the pagination list so only the button for the active page is given the "active" class, making it orange
    setActivePage();
  }
  // Whether we need to reload the entire pagination list or not, reload the table to display the data which should now be rendered to the table
  return loadTable();
}

// This function uses the page.currentPage variable to determine which pagination button should have the "active" class
function setActivePage() {
  // If the anchor tag inside the pagination list item has an 'href' attribute equal to the current page, set it's the class to active
  paginationEl.selectAll("li").each(function () {
    d3.select(this)
      .select("a")
      .classed("active", function (d, i) {
        return this.getAttribute("href") === page.currentPage;
      });
  });
}

// appendPagination completely replaces the current pagination list with a new one with updated numbers
function appendPagination() {
  // get array of pageNumbers which should appear in the pagination list at this current page number
  var pageSubset = page.getPageSubset();

  // Empty the pagination list, add new list item as the "back" button
  paginationEl
    .html("")
    .append("li")
      .append("a")
        .attr("class", "page-direction")
        .attr("href", pageSubset[0] - 1)
        .html("<");

  // For every page number in the pageSubset, create an li tag containing an anchor tag with an href attribute of the page number the pagination button should take the user to when clicked
  for (var i = 0; i < pageSubset.length; i++) {
    var currentPage = pageSubset[i];

    paginationEl
      .append("li")
        .append("a")
          .attr("class", "page-direction")
          .attr("href", currentPage)
          .classed("active", currentPage === page.currentPage)
          .html(currentPage);
  }

  // Append a forwardButton to the pagination element last
  paginationEl
    .append("li")
      .append("a")
        .attr("class", "page-direction")
        .attr("href", pageSubset[0] + pageSubset.length)
        .html(">");
}

function loadTable() {
  // Clear the contents of the tbody on the page, start showing the loader
  var tbody = d3.select("tbody")
    .html("");

  showLoader();

  // resultsThisPage is an array containing the slice of the data which should be rendered to the table on this page
  var resultsThisPage = page.paginate(
    data.filtered,
    page.resultsPerPage(),
    page.currentPage
  );

  // For every object in the resultsThisPage array, construct a table-row containing information about the object
  for (var i = 0; i < resultsThisPage.length; i++) {
    var ufoObject = resultsThisPage[i];
    // Get an array containing the keys of the ufoObject, create a new tablerow element
    var ufoKeys = Object.keys(ufoObject);

    var row = tbody.append("tr")
      .classed("table-row", true);

    for (var j = 0; j < ufoKeys.length; j++) {
      var currentKey = ufoKeys[j];
      // For value in the ufoKeys array, append a new 'td' element into the row, set it's innerHTML to the value of the ufoObject's key

      row.append("td")
        .html(ufoObject[currentKey])
        .classed("text-center", true)
        // add a data-th attribtue to the current cell equal to the currentKey for styling purposes
        .attr("data-th", currentKey);
    }
  }

  hideLoader();
}

// shows the loader while hiding the table
function showLoader() {
  table.style("visibility", "hidden");
  loader.style("display", "block");
}

// hide the loader while showing the table
function hideLoader() {
  table.style("visibility", "visible");
  loader.style("display", "none");
}
