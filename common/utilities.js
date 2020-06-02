let obj = {};

// Use this generic function to quickly search a sorted array for a given simple value,
// such as a string or a number. Note that "endIndex" is non-inclusive. I.e.: if you had
// an array named "myArr":
//
//     Index: 0    1    2    3    4
//     Value: "a", "b", "c", "d", "e"
//
// and you wanted to search it for the element "c", you would call:
//
//     partitionSearchSortedArray("c", myArr, 0, myArr.length);
//
obj.partitionSearchSortedArray = function(valueToFind, inputArr, startIndex, endIndex) {
    if ((endIndex - startIndex) <= 3) {
        for (let i = startIndex; i < endIndex; i++) {
            if (inputArr[i] === valueToFind) {
                return true;
            }
        }
        return false;
    } else {
        let pivotIndex = startIndex + Math.floor((endIndex - startIndex) / 2);
        let pivot = inputArr[pivotIndex];
        if (valueToFind === pivot) {
            return true;
        } else if (valueToFind < pivot) {
            return callPartitionSearchSortedArray(valueToFind, inputArr, startIndex, pivotIndex);
        } else { // valueToFind > pivot
            return callPartitionSearchSortedArray(valueToFind, inputArr, pivotIndex, endIndex);
        }
    }
};

// This function is just here to solve the self-dependency problem
function callPartitionSearchSortedArray(valueToFind, inputArr, startIndex, pivotIndex) {
    return obj.partitionSearchSortedArray(valueToFind, inputArr, startIndex, pivotIndex);
}


// The following function will calculate a node's position from an array of the
// highest average RSSI values from nearby gateways and those gateways' coordinates.
// The input array should have the following format:
//
//     [{
//         latitude:   <xN>,
//         longitude:  <yN>,
//         rssi:       <rssiN>
//     }]
//
// The array can be of any non-zero length.
obj.getPositionFromGwRSSI = function(inputArr) {
    if (inputArr.length > 1) {
        return getPositionFromTwoOrMoreGwRSSI(inputArr);
    } else {
        return {
            latitude:   inputArr[0].latitude,
            longitude:  inputArr[0].longitude,
        };
    }
};

function getPositionFromTwoOrMoreGwRSSI(inputArr) {
    let output = {};

    // The following 3 arrays will all have the same lengths:
    let xi = [];
    let yi = [];
    let allW = [];
    let sumWi = 0;
    inputArr.forEach((gw) => {
        xi.push(gw.latitude);
        yi.push(gw.longitude);

        let wi = getWi(gw.rssi);
        allW.push(wi);
        sumWi += wi;
    });

    let latSums = 0;
    let lonSums = 0;
    for (let i = 0; i < allW.length; i++) {
        latSums += (allW[i] * xi[i]);
        lonSums += (allW[i] * yi[i]);
    }

    output.latitude = latSums / sumWi;
    output.longitude = lonSums / sumWi;

    return output;
}

function getWi(rssi) {
    let di;
    if (rssi <= -100) {
        di = 100;
    } else if (rssi > -100 && rssi < -70) {
        di = -70 - rssi;
    } else { // rssi >= -70
        di = 1;
    }

    return (1 / di);
}

module.exports = obj;
