module.exports = {
    "env": {
        "es6": true,
        "node": true
    },
    "extends": "eslint:recommended",
    "parserOptions": {
        "sourceType": "module"
    },
    "globals": {
        "logger": true,
        "reqFile": true
    },
    "rules": {
        "quotes": [
            "error",
            "double"
        ],
        "semi": [
            "error",
            "always"
        ],
        "no-mixed-spaces-and-tabs": "off",
        "no-case-declarations": "off",
        "space-before-function-paren": [ "error", "never" ],
        "no-console": "off",
        "no-useless-escape": "off",
        "no-fallthrough": "off",
        "keyword-spacing": "error",
        "no-unused-vars": [
            "error",
            {
                "argsIgnorePattern": "next|resp|reject"
            }
        ]
    }
};
