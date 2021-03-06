/**
 * Contains validation-logic that is specific to V3 of the OpenAPI-spec
 */

const { JSONPath: jsonPath } = require('jsonpath-plus'),
    { ApplicationError, ErrorType } = require('../../application-error');

// CONSTANTS

const PATH__EXAMPLE = '$..responses..content.application/json.example',
    PATH__EXAMPLES = '$..responses..content.application/json.examples..value',
    PATH__EXAMPLE__PARAMETER = '$..parameters..example',
    PATH__EXAMPLES__PARAMETER = '$..parameters..examples..value',
    PATH__EXAMPLE__REQUEST_BODY = '$..requestBody.content.application/json.example',
    PATH__EXAMPLES__REQUEST_BODY = '$..requestBody.content.application/json.examples..value',
    PROP__SCHEMA = 'schema',
    PROP__EXAMPLE = 'example',
    PROP__EXAMPLES = 'examples';

const ExampleType = {
    single: 'single',
    multi: 'multi'
};

// PUBLIC API

module.exports = {
    buildValidationMap,
    getJsonPathsToExamples,
    prepare
};

// IMPLEMENTATION DETAILS

/**
 * Get the JSONPaths to the examples
 * @returns {Array.<String>}    JSONPaths to the examples
 */
function getJsonPathsToExamples() {
    return [
        PATH__EXAMPLE,
        PATH__EXAMPLES,
        PATH__EXAMPLE__PARAMETER,
        PATH__EXAMPLES__PARAMETER,
        PATH__EXAMPLE__REQUEST_BODY,
        PATH__EXAMPLES__REQUEST_BODY
    ];
}

/**
 * Builds a map with the path to the repsonse-schema as key and the paths to the examples, as value. The path of the
 * schema is derived from the path to the example and doesn't necessarily mean that the schema actually exists.
 * @param {Array.<String>}  pathsExamples   Paths to the examples
 * @returns {Object.<String, String>} Map with schema-path as key and example-paths as value
 * @private
 */
function buildValidationMap(pathsExamples) {
    const exampleTypesOfSchemas = new Map();
    return pathsExamples.reduce((validationMap, pathExample) => {
        const { pathSchemaAsArray, exampleType } = _getSchemaPathOfExample(pathExample),
            pathSchema = jsonPath.toPathString(pathSchemaAsArray),
            exampleTypeOfSchema = exampleTypesOfSchemas.get(pathSchema);
        if (exampleTypeOfSchema) {
            exampleTypeOfSchema !== exampleType && _throwMutuallyExclusiveError(pathSchemaAsArray);
        }
        exampleTypesOfSchemas.set(pathSchema, exampleType);
        validationMap[pathSchema] = (validationMap[pathSchema] || new Set())
            .add(pathExample);
        return validationMap;
    }, {});
}

/**
 * Pre-processes the OpenAPI-spec, for further use.
 * The passed spec won't be modified. If a modification happens, a modified copy will be returned.
 * @param {Object}  openapiSpec     The OpenAPI-spec as JSON-schema
 * @return {Object} The prepared OpenAPI-spec
 */
function prepare(openapiSpec) {
    // None yet. I added this to implement `nullable` until I figured there was a property for that.
    // I'll leave this here for now, as pre-processing might become necessary for other things.
    // A "cloneDeep"-function will be required though (eg. `lodash.clonedeep`-dependency)
    return openapiSpec;
}

/**
 * Gets a JSON-path to the corresponding response-schema, based on a JSON-path to an example.
 *
 * It is assumed that the JSON-path to the example is valid and existing.
 * @param {String}  pathExample JSON-path to example
 * @returns {{
 *     exampleType: ExampleType,
 *     pathSchema: String
 * }} JSON-path to the corresponding response-schema
 * @private
 */
function _getSchemaPathOfExample(pathExample) {
    const pathSegs = jsonPath.toPathArray(pathExample).slice(),
        idxExample = pathSegs.lastIndexOf(PROP__EXAMPLE),
        /** @type ExampleType */
        exampleType = idxExample > -1
            ? ExampleType.single
            : ExampleType.multi,
        idxExamples = exampleType === ExampleType.single
            ? idxExample
            : pathSegs.lastIndexOf(PROP__EXAMPLES);
    pathSegs.splice(idxExamples, pathSegs.length - idxExamples, PROP__SCHEMA);
    return {
        exampleType,
        pathSchemaAsArray: pathSegs
    };
}

/**
 * Checks if only `example` or `examples` is set for the schema, as they are mutually exclusive by OpenAPI-spec.
 * @param {Array.<String>}  pathSchemaAsArray   JSON-path to the Schema, as JSON-path-array
 * @throws ApplicationError if both are set
 * @private
 */
function _throwMutuallyExclusiveError(pathSchemaAsArray) {
    const pathContextAsArray = pathSchemaAsArray.slice(0, pathSchemaAsArray.length - 1);    // Strip `schema` away
    throw ApplicationError.create({
        type: ErrorType.errorAndErrorsMutuallyExclusive,
        message: 'Properties "error" and "errors" are mutually exclusive',
        params: {
            pathContext: jsonPath.toPointer(pathContextAsArray)
        }
    });
}
