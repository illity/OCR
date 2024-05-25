// A worker is created once and used every time a user uploads a new file.  
const worker = await Tesseract.createWorker("eng", 1, {
    ans: 'TESTOCR_TEXT'
});


function cropImageAndReturnFile(file, cropXPercentage, cropY, cropWidthPercentage, cropHeight) {
    return new Promise((resolve, reject) => {
        var reader = new FileReader();

        reader.onload = function (event) {
            var img = new Image();
            img.onload = function () {
                var canvas = document.createElement('canvas');
                var ctx = canvas.getContext('2d');

                // Calculate cropX based on percentage
                var cropX = img.width * cropXPercentage / 100;

                // Calculate cropWidth based on percentage
                var cropWidth = img.width * cropWidthPercentage / 100;

                // Set canvas dimensions to match the crop size
                canvas.width = cropWidth;
                canvas.height = cropHeight;

                // Draw the cropped portion of the image onto the canvas
                ctx.drawImage(img, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

                // Convert the canvas content back to a Blob object (file)
                canvas.toBlob(function (blob) {
                    // Create a new file with the cropped content
                    var croppedFile = new File([blob], file.name, { type: file.type });
                    resolve(croppedFile);
                }, file.type);
            };
            img.src = event.target.result;
        };

        reader.onerror = function (error) {
            reject(error);
        };

        reader.readAsDataURL(file);
    });
}


var data = []


const recognize = async function (evt) {
    const files = evt.target.files;

    for (let i = 0; i < files.length; i++) {
        const file = files[i];

        const reader = new FileReader();
        reader.onload = async function (event) {
            const img = new Image();
            img.onload = async function () {
                const imageWidth = img.width;
                const imageHeight = img.height;

                const topPercentage = 11; // top position percentage
                const heightPercentage = 82; // height percentage
                const leftPercentage = 0; // left position percentage
                const widthPercentage = 70; // width percentage

                // Calculate top position based on percentage
                const top = (topPercentage / 100) * imageHeight;

                // Calculate height based on percentage
                const height = (heightPercentage / 100) * imageHeight;

                // Calculate left position based on percentage
                const left = (leftPercentage / 100) * imageWidth;

                // Calculate width based on percentage
                const width = (widthPercentage / 100) * imageWidth;

                const [result, result2] = await Promise.all([
                    worker.recognize(file, {
                        rectangle: {
                            top: top,
                            left: left,
                            width: width,
                            height: height,
                        },
                    }).then(response => {
                        return response.data.lines.map(x => x.text)
                            .map(str => str.replace(/[\s\n]/g, ''))
                            .reduce((acc, curr, index, array) => index % 2 === 0 ? [...acc, { name: curr, date: array[index + 1] }] : acc, []);
                    }),
                    worker.recognize(file, {
                        rectangle: {
                            top: top,
                            left: left + width,
                            width: imageWidth - width,
                            height: height,
                        },
                    }).then(response => {
                        return response.data.lines.map(x => x.text)
                            .map(str => str.replace(/[\s\nRS$,-]/g, ''))
                            .map(v => v / 100);
                    })
                ]);

                const fileData = result.map((obj, index) => ({
                    name: obj.name,
                    date: obj.date,
                    value: result2[index]
                }));

                data = data.concat(fileData); // Concatenate the data from current file with the data

                function removeDuplicates(array) {
                    const uniqueObjects = [];
                    const keys = new Set();

                    array.forEach(obj => {
                        const key = JSON.stringify(obj);
                        if (!keys.has(key)) {
                            keys.add(key);
                            uniqueObjects.push(obj);
                        }
                    });

                    return uniqueObjects;
                }
                data = removeDuplicates(data);

                function sortByDate(objects) {
                    function parseDate(dateString) {
                        var parts = dateString.split('/');
                        return new Date(new Date().getFullYear(), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
                    }

                    return objects.sort(function (a, b) {
                        var dateA = parseDate(a.date);
                        var dateB = parseDate(b.date);
                        return dateA - dateB;
                    });
                }
                data = sortByDate(data);
                createTable(data);
            };
            img.src = event.target.result;
        };

        reader.readAsDataURL(file);
    }
};




function createTable(objects) {
    var table = document.getElementById('theTable');

    // Clear existing content in the table
    table.innerHTML = '';

    // Create table header
    var headerRow = table.insertRow();
    var filterInputs = {}; // Object to store filter input elements

    // Add cells for each object property
    for (var key in objects[0]) {
        if (objects[0].hasOwnProperty(key)) {
            var headerCell = headerRow.insertCell();


            // Add text to the header cell
            var headerText = document.createElement('span');
            headerText.textContent = key.toUpperCase(); // Convert to uppercase
            headerCell.appendChild(headerText);

            // Create filter input for each column
            var filterInput = document.createElement('input');
            filterInput.type = 'text';
            filterInput.placeholder = 'Filter ' + key;
            filterInput.classList.add('filter-input');
            filterInput.addEventListener('input', createFilterHandler(key)); // Attach event listener
            filterInputs[key] = filterInput; // Store filter input element
            headerCell.appendChild(filterInput); // Append input to header cell

        }
    }

    // Header for the exclude column
    var excludeHeaderCell = headerRow.insertCell();
    excludeHeaderCell.textContent = "EXCLUDE";

    // Initialize total value
    var totalValue = 0;

    // Create table rows
    for (var i = 0; i < objects.length; i++) {
        var row = table.insertRow();

        // Add cells for each object property
        for (var key in objects[i]) {
            if (objects[i].hasOwnProperty(key)) {
                var cell = row.insertCell();
                cell.textContent = objects[i][key];
            }
        }

        // Add checkbox cell for excluding item
        var excludeCell = row.insertCell();
        var excludeCheckbox = document.createElement('input');
        excludeCheckbox.type = 'checkbox';

        excludeCheckbox.addEventListener('change', function (event) {
            // Get the row corresponding to the clicked checkbox
            var clickedRow = event.target.parentElement.parentElement;
            // Apply strikethrough style based on checkbox status

            clickedRow.style.textDecoration = this.checked ? "line-through" : "none";
            // Recalculate total value
            calculateTotal();
        });

        excludeCell.appendChild(excludeCheckbox);

        // Add value to total if it's not initially excluded
        totalValue += parseFloat(objects[i].value || 0);
    }

    // Add total line
    var totalRow = table.insertRow();
    var totalCell = totalRow.insertCell();
    totalCell.textContent = "TOTAL";

    var lastDateCell = totalRow.insertCell();
    lastDateCell.textContent = objects[objects.length - 1].date; // Assuming the last object's date is the last date

    var totalValueCell = totalRow.insertCell();
    totalValueCell.textContent = totalValue.toFixed(2); // Display total with 2 decimal places


    // Add checkbox cell for excluding item
    var excludeCell = totalRow.insertCell();
    var excludeCheckbox = document.createElement('input');
    excludeCheckbox.type = 'checkbox';

    excludeCheckbox.addEventListener('change', function (event) {
        for (var j = 0; j < objects.length; j++) {
            const row = document.getElementById('theTable').rows[j + 1];
            if (!row.style.display.includes("none")) {
                row.querySelector('input[type="checkbox"]').checked = this.checked
                row.style.textDecoration = this.checked ? "line-through" : "none";
            }
        }


        // Recalculate total value
        calculateTotal();
    });

    excludeCell.appendChild(excludeCheckbox);

    // Add value to total if it's not initially excluded
    totalValue += parseFloat(objects[i].value || 0);

    // Function to recalculate total value
    function calculateTotal() {
        totalValue = 0;
        for (var j = 0; j < objects.length; j++) {
            if (!document.getElementById('theTable').rows[j + 1].style.textDecoration.includes("line-through") &&
                !document.getElementById('theTable').rows[j + 1].style.display.includes('none')) {
                totalValue += parseFloat(objects[j].value || 0);
            }
        }
        totalValueCell.textContent = totalValue.toFixed(2); // Update total value cell
    }

    // Function to create filter handler for a specific column
    function createFilterHandler(columnKey) {
        return function () {
            var filterValue = filterInputs[columnKey].value.toLowerCase();
            var columnIndex = Array.from(table.rows[0].cells).findIndex(cell => cell.textContent.trim().toUpperCase() === columnKey.toUpperCase());

            for (var i = 1; i < table.rows.length - 1; i++) { // Start from index 1 to skip header row
                var row = table.rows[i];
                var cellValue = row.cells[columnIndex].textContent.toLowerCase();

                if (cellValue.includes(filterValue)) {
                    row.style.display = ''; // Show row if it matches filter
                } else {
                    row.style.display = 'none'; // Hide row if it doesn't match filter
                }
            }
            calculateTotal();
        };
    }

}


const elm = document.getElementById('uploader');
elm.addEventListener('change', recognize);
