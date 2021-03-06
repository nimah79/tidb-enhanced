# tidb-enhanced
TiDB in browser, with enhanced console

[![Standard JS](https://img.shields.io/badge/code%20style-standard-standard.svg)](https://github.com/standard/standard)

## How to use

1. Install Python 3
2. Run a web server using `python -m http.server 8000`
3. Open http://127.0.0.1:8000 in your browser

## Features

- More beautiful color scheme
- MySQL-like prompt text (uses `SELECT DATABASE()` to show current using database)
- Blinking cursor
- Smooth scroll when executing commands
- Fix scrolling to top when pasting query (needs improvement)
- MySQL-like error codes
- JavaScript API for fetching list of databases, tables, and table schemas (needs improvement)

## JavaScript API

- Get database names: `await getDatabaseNames()`
- Get table names of a database: `await getTableNames(databaseName)`
- Get table schema: `await getTableSchema(databaseName, tableName)`
- Get table contents: `await getTableContents(databaseName, tableName)`

## TODO

- Fix query splitting
- Autocomplete
- Syntax highlighting
