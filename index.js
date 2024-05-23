// A worker is created once and used every time a user uploads a new file.  
const worker = await Tesseract.createWorker("eng", 1, {
    ans: 'TESTOCR_TEXT'
});


function cropImageAndReturnFile(file, cropX, cropY, cropWidth, cropHeight) {
    return new Promise((resolve, reject) => {
        var reader = new FileReader();

        reader.onload = function (event) {
            var img = new Image();
            img.onload = function () {
                var canvas = document.createElement('canvas');
                var ctx = canvas.getContext('2d');

                // Set canvas dimensions to match the crop size
                canvas.width = cropWidth;
                canvas.height = cropHeight;

                // Draw the cropped portion of the image onto the canvas
                ctx.drawImage(img, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

                //if want to see image
                //document.body.append(canvas)

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
    Tesseract.rectangle

    for (let i = 0; i < files.length; i++) {
        const [result, result2] = await Promise.all([
            worker.recognize(files[i], {
                rectangle: {
                    top: 160,
                    left: 0,
                    width: 400,
                    height: 1040,
                },
            }).then(response => {
                return response.data.lines.map(x => x.text)
                    .map(str => str.replace(/[\s\n]/g, ''))
                    .reduce((acc, curr, index, array) => index % 2 === 0 ? [...acc, { name: curr, date: array[index + 1] }] : acc, []);
            }),
            worker.recognize(files[i], {
                rectangle: {
                    top: 160,
                    left: 400,
                    width: 150,
                    height: 1040,
                },
            }).then(response => {
                return response.data.lines.map(x => x.text)
                    .map(str => str.replace(/[\s\nRS$,-]/g, ''))
                    .map(v=>v/100)  ;
            })
        ]);


        const fileData = result.map((obj, index) => ({
            name: obj.name,
            date: obj.date,
            value: result2[index]
        }));

        data = data.concat(fileData); // Concatenate the data from current file with the data
    }
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
    createTable(data)
}




function createTable(objects) {
    var table = document.getElementById('theTable');
    
    // Clear existing content in the table
    table.innerHTML = '';

    // Create table header
    var headerRow = table.insertRow();
    for (var key in objects[0]) {
        if (objects[0].hasOwnProperty(key)) {
            var headerCell = headerRow.insertCell();
            headerCell.textContent = key.toUpperCase(); // Convert to uppercase
        }
    }

    // Initialize total value
    var totalValue = 0;

    // Create table rows
    for (var i = 0; i < objects.length; i++) {
        var row = table.insertRow();
        var isExcluded = objects[i].name.includes("CARREFOUR") || objects[i].name.includes("DONA");

        for (var key in objects[i]) {
            if (objects[i].hasOwnProperty(key)) {
                var cell = row.insertCell();
                cell.textContent = objects[i][key];
            }
        }

        // Apply strikethrough style if the name contains "CARREFOUR" or "DONA"
        if (isExcluded) {
            row.style.textDecoration = "line-through";
        } else {
            // Add value to total if it's not "CARREFOUR" or "DONA"
            totalValue += parseFloat(objects[i].value || 0);
        }
    }

    // Add total line
    var totalRow = table.insertRow();
    var totalCell = totalRow.insertCell();
    totalCell.textContent = "TOTAL";

    var lastDateCell = totalRow.insertCell();
    lastDateCell.textContent = objects[objects.length - 1].date; // Assuming the last object's date is the last date

    var totalValueCell = totalRow.insertCell();
    totalValueCell.textContent = totalValue.toFixed(2); // Display total with 2 decimal places
}

const elm = document.getElementById('uploader');
elm.addEventListener('change', recognize);
