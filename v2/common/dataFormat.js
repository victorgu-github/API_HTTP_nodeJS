// This file is meant to contain any function which merely applies formatting to any
// of the Web API's various user input (e.g.: pad number strings with zeros, convert
// integers to float strings, etc.).
// Add any generic input formatting functions inside this file.

let dataFormat = {};

// To use this function, pass it your model, a single Mongo document as received in
// your database callback function (i.e.: no need to JSON.parse(JSON.stringify(...)),
// it beforehand), and a boolean value representing whether or not you want to add
// nulls for any missing fields. This function returns a cleaned object with only the
// fields as defined in your model's schema, and if applicable, "null" values for
// missing fields.
// --------- New in v2: ---------
// This function now also formats the output of the resulting data to conform to our
// Web API's coding standards (i.e.: first letter is lowercase). This brings old data
// structures in line with our standards.
dataFormat.enforceSchemaOnDocument = function(model, obj, insertNullsForMissingFields) {
    if (model === undefined || obj === undefined || insertNullsForMissingFields === undefined)
        throw new Error("'enforceSchemaOnDocument' function takes 3 arguments: model (object), obj (object), insertNullsForMissingFields (boolean)");
    let output = {};
    let mongoFields = [ "_id", "__v", "id", "$init" ];
    let approvedFields = Object.keys(model.schema.tree);
    approvedFields = approvedFields.filter((field) => { return mongoFields.includes(field) === false; });

    approvedFields.forEach((field) => {
        let fieldIsObject = fieldIsANonMongooseObject(model, field);
        if (approvedFields.includes(field)) {
            output[dataFormat.makeFirstLetterLowercase(field)] = obj[field];
            if (output[field] === undefined && insertNullsForMissingFields) {
                output[field] = null;
                // If missing field is supposed to be an object, insert an empty object
                // here so that we can insert all of its children fields in the section
                // below.
                if (fieldIsObject) {
                    output[field] = {};
                }
            }
        }
        // Recurse into sub-objects to control the entire object's interface, in
        // accordance with the schema:
        if (output[field] !== undefined && fieldIsObject) {
            let subModel = { schema: { tree: model.schema.tree[field] } };
            let embObjKeys = Object.keys(model.schema.tree[field]);
            // This is to handle the case where you have an embedded object with a
            // default value:
            if (embObjKeys.includes("type") && Object.keys(model.schema.tree[field].type).includes("type") === false)
                subModel = { schema: { tree: model.schema.tree[field].type } };
            output[field] = dataFormat.enforceSchemaOnDocument(subModel, output[field], insertNullsForMissingFields);
        }
    });

    return output;
};

dataFormat.enforceTopLevelOfSchema = function(model, obj) {
    if (model === undefined || obj === undefined)
        throw new Error("'enforceSchemaOnArray' function takes 2 arguments: model (object), obj (object)");
    let result;
    if (Array.isArray(obj)) {
        result = enforceSchemaOnArray(model, obj);
    }
    else {
        result = enforceSchemaOnObject(model, obj);
    }
    return result;
};

function enforceSchemaOnArray(model, array) {
    if (model === undefined || array === undefined)
        throw new Error("'enforceSchemaOnArray' function takes 2 arguments: model (object), array (object)");
    let result = [];
    for (let index in array) {
        let element = array[index];
        element = enforceSchemaOnObject(model, element);
        result.push(element);
    }
    return result;
}

function enforceSchemaOnObject(model, obj) {
    if (model === undefined || obj === undefined)
        throw new Error("'enforceSchemaOnObject' function takes 2 arguments: model (object), obj (object)");
    let output = {};
    let mongoFields = ["_id", "__v", "id", "$init"];
    let approvedFields = Object.keys(model.schema.tree);
    approvedFields = approvedFields.filter((field) => { return !mongoFields.includes(field); });

    approvedFields.forEach((field) => {
        let fieldIsObject = fieldIsANonMongooseObject(model, field);
        output[dataFormat.makeFirstLetterLowercase(field)] = obj[field];
        if (output[field] === undefined) {
            output[field] = null;
        }
        // Recurse into sub-objects to control the entire object's interface, in
        // accordance with the schema:
        if (output[field] !== undefined && output[field] !== null && fieldIsObject) {
            let subModel = { schema: { tree: model.schema.tree[field] } };
            let embObjKeys = Object.keys(model.schema.tree[field]);
            // This is to handle the case where you have an embedded object with a
            // default value:
            if (embObjKeys.includes("type") && Object.keys(model.schema.tree[field].type).includes("type") === false)
                subModel = { schema: { tree: model.schema.tree[field].type } };
            output[field] = dataFormat.enforceTopLevelOfSchema(subModel, output[field]);
        }
        // ble is an array, right now, don't find a good way to deal with array field
        else if (output[field] !== undefined && output[field] !== null && field === "ble") {
            let subModel = { schema: { tree: model.schema.tree[field].type[0] } };
            let embObjKeys = Object.keys(model.schema.tree[field].type[0]);
            if (embObjKeys.includes("type") && Object.keys(model.schema.tree[field].type).includes("type") === false)
                subModel = { schema: { tree: model.schema.tree[field].type } };
            output[field] = dataFormat.enforceTopLevelOfSchema(subModel, output[field]);
        }
    });

    return output;
}

function fieldIsANonMongooseObject(model, field) {
    let isObject = false;
    let fieldVal = model.schema.tree[field];
    // Start with a basic type check. We have to filter out arrays, dates, and nulls,
    // which are all technically objects in JavaScript.
    if (typeof fieldVal === "object" && Array.isArray(fieldVal) === false &&
        (fieldVal instanceof Date) === false && fieldVal !== null) {
        // Unfortunately, checking whether a particular schema field is an object isn't
        // as simple as "if (typeof fieldVal === 'object')", because
        // some fields in the schema will contain objects with fields indicating, among
        // other things, default values. So we need to check whether it's a "real object"
        // (i.e.: isn't just a Mongoose config object).

        // These are the various conditions under which we say this object is a non-
        // Mongoose object:
        //   Condition 1: schema's value for this field is an object with a "type" sub-
        //       field and where the value for "type" is an object. This handles the
        //       case where you have different Mongoose properties for that parent field
        //       (such as a "default" field, for default values).
        let cond1 = (fieldVal.type !== undefined && typeof fieldVal.type === "object" &&
                     Array.isArray(fieldVal.type) === false);
        // Condition 2: schema's value for this field is an object with no "type" sub-
        //       field.
        let cond2 = (Object.keys(fieldVal).includes("type") === false);
        if (cond1 || cond2)
            isObject = true;
    }

    return isObject;
}

dataFormat.makeFirstLetterLowercase = function(inputStr) {
    return inputStr.substring(0, 1).toLowerCase() + inputStr.substring(1, inputStr.length);
};

module.exports = dataFormat;
