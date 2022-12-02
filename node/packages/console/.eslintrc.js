module.exports = {
  parser: '@typescript-eslint/parser', // Specifies the ESLint parser
  parserOptions: {
    ecmaVersion: 2020, // Allows for the parsing of modern ECMAScript features
    sourceType: 'module', // Allows for the use of imports
    project: './tsconfig.eslint.json',
    tsconfigRootDir: __dirname,
  },
  extends: [
    'plugin:@typescript-eslint/recommended', // Uses the recommended rules from the @typescript-eslint/eslint-plugin
    'plugin:prettier/recommended', // Enables eslint-plugin-prettier and eslint-config-prettier. This will display prettier errors as ESLint errors. Make sure this is always the last configuration in the extends array.
  ],
  rules: {
    // Place to specify ESLint rules. Can be used to overwrite rules specified from the extended configs
    // e.g. "@typescript-eslint/explicit-function-return-type": "off",
    // Severity should be one of the following: 0 = off, 1 = warn, 2 = error
    'no-return-await': 2,
    '@typescript-eslint/no-floating-promises': 2,
    '@typescript-eslint/no-require-imports': 2,
    '@typescript-eslint/explicit-member-accessibility': 2,
    '@typescript-eslint/array-type': 2,
  },
  overrides: [
    {
      files: ['*.test.ts'],
      rules: {
        // So we can ts-ignore mock argument signatures
        '@typescript-eslint/ban-ts-comment': 'off',
      },
    },
  ],
};
