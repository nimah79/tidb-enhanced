let dbname = '(none)'

function unimplemented (callback) {
  const err = new Error('not implemented')
  err.code = 'ENOSYS'
  callback(err)
}

function unimplemented1 (_1, callback) { unimplemented(callback) }

function unimplemented2 (_1, _2, callback) { unimplemented(callback) }

function bootstrapGo () {
  const go = new Go()
  fetch('app/mysql.css')
    .then(progressHandler)
    .then(r => r.arrayBuffer())
    .then(buffer => WebAssembly.instantiate(buffer, go.importObject))
    .then(result => {
      fs.stat = fs.lstat = fs.unlink = fs.rmdir = unimplemented1
      fs.mkdir = unimplemented2
      go.run(result.instance)
      document.getElementById('loading').style.display = 'none'
      bootstrapTerm()
    })
}

function executeSQLAsync (query) {
  return new Promise(resolve => {
    executeSQL(query, function (result) {
      result = changeErrorStyle(result)
      resolve({ result: result, message: getResultMessage(result), table: getResultTable(result) })
    })
  })
}

function getResultMessage (result) {
  return result.replace(/^\+-.*-\+\n/s, '').trim()
}

function getResultTable (result) {
  const headerLine = result
    .substring(
      result.indexOf('+\n| ') + 2,
      result.indexOf('| \n+') + 1
    )
  const header = headerLine
    .slice(2, -1)
    .split('|')
    .map((element) => element.trim())
  const separatorIndexes = []
  for (let i = 1; i < headerLine.length; i++) {
    if (headerLine[i] === '|') {
      separatorIndexes.push(i)
    }
  }
  const rowsStr = result.substring(result.lastIndexOf('+\n| ') + 3, result.lastIndexOf('| \n+') + 1)
  let tmpIndex = 0
  const rows = []
  while (true) {
    const row = []
    let finished = false
    for (const separatorIndex of separatorIndexes) {
      const until = rowsStr.indexOf('|', tmpIndex)
      if (until === -1) {
        finished = true
        break
      }
      let value = rowsStr.substring(tmpIndex, until).trim()
      if (value === '<nil>') {
        value = null
      }
      row.push(value)
      tmpIndex = until + 1
    }
    tmpIndex += 3
    if (finished || row.length === 0) {
      break
    }
    rows.push(row)
  }

  return { header: header, rows: rows }
}

function changeErrorStyle (result) {
  return result
    .replace('TiDB', 'MySQL')
    .replace(/^\[\w+:(\d+)\]/m, '#$1 - ')
}

async function updateDbName () {
  const result = await executeSQLAsync('SELECT DATABASE()')
  dbname = result.table[0]['DATABASE()']
  if (!dbname) {
    dbname = '(none)'
  }
  window.shell.promptLabel = 'MySQL [' + dbname + ']> '
}

async function getDatabaseNames () {
  const result = await executeSQLAsync('SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA')
  return result.table.rows.map((row) => row[0])
}

async function getTableNames (databaseName) {
  const result = await executeSQLAsync('SHOW TABLES FROM `' + databaseName.replace('`', '``') + '`')
  return result.table.rows.map((row) => row[0])
}

async function getTableSchema (databaseName, tableName) {
  const result = await executeSQLAsync('DESCRIBE `' + databaseName.replace('`', '``') + '`.`' + tableName.replace('`', '``') + '`')
  return result.table.rows.map((row) => row[0])
}

async function getTableContents (databaseName, tableName) {
  const result = await executeSQLAsync('SELECT * FROM `' + databaseName.replace('`', '``') + '`.`' + tableName.replace('`', '``') + '`')
  return result
}

function bootstrapTerm () {
  window.term = $('<div class="term">')
  $('body').append(term)
  window.shell = term.console({
    promptLabel: 'MySQL [(none)]> ',
    continuedPromptLabel: ' -> ',
    commandValidate: function (line) {
      return line != ''
    },
    commandHandle: async function (line, report) {
      line = line.trim()
      if (!line.endsWith(';')) {
        window.shell.continuedPrompt = true
        return
      }
      window.shell.continuedPrompt = false
      let msg = await executeSQLAsync(line)
      msg = msg.result
      if (line.toLowerCase().includes('use') || line.toLowerCase().includes('drop')) {
        await updateDbName()
      }
      report([{
        msg,
        className: 'jquery-console-message-success'
      }])
    },
    autofocus: true,
    animateScroll: true,
    promptHistory: true
  })

  const blinkCursor = function () {
    $('span.jquery-console-cursor').css('background', cursor ? 'rgba(255, 255, 255, 0)' : 'rgba(255, 255, 255, 0.5)')
    cursor = !cursor
  }
  let cursor = true
  let cursorBlinkInterval = setInterval(blinkCursor, 650)
  $(document).on('click', function (e) {
    $('.jquery-console-inner').click()
  })
  $('.jquery-console-typer').on('keydown', function (e) {
    $('html, body').scrollTop($(document).height())
    clearInterval(cursorBlinkInterval)
    cursor = false
    blinkCursor()
    cursorBlinkInterval = setInterval(blinkCursor, 650)
  })
}

bootstrapGo()

function progress ({
  loaded,
  total
}) {
  const num = Math.round(loaded / total * 100) + '%'
  $('.loading-before').css({
    width: num
  })
  if (num == '100%') {
    $('.loading').html('<div class="loading-before">Running...</div>Running...')
    $('.loading-before').addClass('animated')
  }
}

function progressHandler (response) {
  if (!response.ok) {
    throw Error(response.status + ' ' + response.statusText)
  }

  if (!response.body) {
    throw Error('ReadableStream not yet supported in this browser.')
  }

  // hardcode since some CDN does NOT return content-length for compressed content
  const total = 93514823
  let loaded = 0

  return new Response(
    new ReadableStream({
      start (controller) {
        const reader = response.body.getReader()

        read()

        function read () {
          reader.read().then(({
            done,
            value
          }) => {
            if (done) {
              controller.close()
              return
            }
            loaded += value.byteLength
            progress({
              loaded,
              total
            })
            controller.enqueue(value)
            read()
          }).catch(error => {
            console.error(error)
            controller.error(error)
          })
        }
      }
    })
  )
}
