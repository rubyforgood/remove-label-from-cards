const core = require('@actions/core');
const github = require('@actions/github');
const token = core.getInput('token');
const octokit = github.getOctokit(token);
// Javascript destructuring assignment. See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Destructuring_assignment
const {owner, repo} = github.context.repo

// Determines if an object is an object
//  @param    {any} variable The object to check
//  @returns  {boolean} true if variable is an object, false otherwise
function isObject (variable) {
  return typeof variable === 'object' && !Array.isArray(variable) && variable !== null
}

// Determines if an object is a nonempty string
//  @param    {any} str The object to check
//  @returns  {boolean} true if str is a nonempty string, false otherwise
function isNonEmptyString (str) {
  return typeof str === 'string' && str.length
}

// Lists up to MAX_CARDS_PER_PAGE cards from a column
//  @param    {integer} columnId The id of the column containing the cards
//  @param    {integer} pageNumber The page of up to MAX_CARDS_PER_PAGE cards to retrieve
//              default 1
//  @return   {Promise} A promise representing fetching the page of cards
//    @fulfilled {Array} The card data as an array of objects
//  @throws   {TypeError}  for a parameter of the incorrect type
//  @throws   {RangeError} if columnId is negative
//  @throws   {RangeError} if pageNumber is less than 1
//  @throws   {Error} if an error occurs while trying to fetch the card data
async function getCardPage (columnId, pageNumber = 1) {
  if (typeof columnId === 'string') {
    columnId = parseInt(columnId)

    if (!columnId) { // The column id isn't going to be 0
      throw new TypeError('Param columnId is not an integer')
    }
  }

  if (typeof pageNumber === 'string') {
    pageNumber = parseInt(pageNumber)

    if (!pageNumber) { // The column id isn't going to be 0
      throw new TypeError('Param pageNumber is not an integer')
    }
  }

  if (!Number.isInteger(columnId)) {
    throw new TypeError('Param columnId is not an integer')
  } else if (columnId < 0) {
    throw new RangeError('Param columnId cannot be negative')
  }

  if (!Number.isInteger(pageNumber)) {
    throw new TypeError('Param pageNumber is not an integer')
  } else if (pageNumber < 1) {
    throw new RangeError('Param pageNumber cannot be less than 1')
  }

  return await octokit.projects.listCards({
    column_id: columnId,
    archived_state: 'not_archived',
    page: pageNumber,
    per_page: MAX_CARDS_PER_PAGE
  })
}

// Get a column by name in a project
//  @param    {columnName} columnName The name of the column
//  @param    {integer}    projectId The id of the project containing the column
//  @return   {Promise} A promise representing fetching of the column
//    @fulfilled {Object} An object representing the first column with name matching columnName
//                        undefined if the column could not be found
//  @throws   {TypeError}  for a parameter of the incorrect type
//  @throws   {RangeError}  if projectId is less than 1
//  @throws   {Error} if an error occurs while trying to fetch the project data
async function getColumn (columnName, projectId) {
  if (typeof projectId === 'string') {
    columnId = parseInt(projectId)

    if (!projectId) { // The project id isn't going to be 0
      throw new TypeError('Param projectId is not an integer')
    }
  }

  if (!Number.isInteger(projectId)) {
    throw new TypeError('Param projectId is not an integer')
  } else if (projectId < 0) {
    throw new RangeError('Param projectId cannot be negative')
  }

  const columnList = await octokit.request('GET /projects/{project_id}/columns', {
    project_id: projectId
  })

  return columnList.data.find((column) => {
    return column.name === columnName
  })
}

// Lists all the cards for a column that are issues
//  @param    {integer} columnId The id of the column containing the cards
//  @return   {Promise} A promise representing fetching of card data
//    @fulfilled {Array} The card data as an array of objects
//  @throws   {TypeError}  for a parameter of the incorrect type
//  @throws   {RangeError} if columnId is negative
//  @throws   {Error} if an error occurs while trying to fetch the card data
async function getColumnCardIssues (columnId) {
  if (typeof columnId === 'string') {
    columnId = parseInt(columnId)

    if (!columnId) { // The column id isn't going to be 0
      throw new TypeError('Param columnId is not an integer')
    }
  }

  if (!Number.isInteger(columnId)) {
    throw new TypeError('Param columnId is not an integer')
  } else if (columnId < 0) {
    throw new RangeError('Param columnId cannot be negative')
  }

  let cardIssues = []
  let cardPage
  let page = 1

  do {
    cardPage = await getCardPage(columnId, page)

    // filter out non issue cards
    let pageCardIssues = cardPage.data.filter((card) => {
      return card.content_url
    })
    
    cardIssues.push(...pageCardIssues)
    page++
  } while (cardPage.data.length === MAX_CARDS_PER_PAGE)

  return cardIssues
}

// Get a list of labels for an issue
//  @param    {number} issueNumber The number of the issue to fetch labels for
//  @return   {Promise} A promise representing fetching of the labels for an issue
//    @fulfilled {Object} A list of objects each representing a label
//  @throws   {TypeError}  for a parameter of the incorrect type
//  @throws   {RangeError} when issueNumber is less than 1
//  @throws   {Error}      if an error occurs while trying to fetch the project data
async function getIssueLabels (issueNumber) {
  if (!Number.isInteger(issueNumber)) {
    throw new TypeError('Param issueNumber must be an integer')
  }

  return await octokit.request('GET /repos/{owner}/{repo}/issues/{issue_number}/labels', {
    owner: owner,
    repo: repo,
    issue_number: issueNumber
  })
}

// Get the project with name passed into projectName from the current repo
//  @param    {string} projectName The name of the project
//  @return   {Promise} A promise representing fetching of the project
//    @fulfilled {Object} An object representing the first project with name matching projectName
//                        undefined if the project could not be found
//  @throws   {TypeError} for a parameter of the incorrect type
//  @throws   {Error}     if an error occurs while trying to fetch the project data
async function getProject (projectName) {
  if (!isNonEmptyString(projectName)) {
    throw new TypeError('Param projectName must be a non empty string')
  }

  const repoProjects = await octokit.request('GET /repos/{owner}/{repo}/projects', {
    owner: owner,
    repo: repo
  })

  return repoProjects.data.find((project) => {
    return project.name === projectName
  })
}

// Adds a label to a card if it is an issue
//  @param    {object} card   An object representing the card to be labeled
//  @param    {Array}  labels The list of labels to be added
//  @return   {Promise} A promise representing the labeling of the card
//  @throws   {TypeError}  for a parameter of the incorrect type
//  @throws   {Error} if an error occurs while labeling the card
async function labelCardIssue (card, labels) {
  if (!isObject(card)) {
    throw new TypeError('Param card is not an object')
  }

  if (!Array.isArray(labels)) {
    reject(new TypeError('Param labels must be an array'))
  }

  if (!card.content_url) {
    throw new ReferenceError(`Card with id: ${ card.id } is missing field "content_url"`)
  }

  const issueNumberMatchCapture = card.content_url.match(/\/issues\/(\d+)$/)

  if (!issueNumberMatchCapture || issueNumberMatchCapture.length < 2) {
    throw new Error(`Failed to extract issue number from url: ${card.content_url}`)
  }

  const issueNumber = issueNumberMatchCapture[1]

  return octokit.issues.addLabels({
    owner: owner,
    repo: repo,
    issue_number: issueNumber,
    labels: labels
  })
}

// Adds a github labeld to each card of a list
//  @param    {Array} cardData The list of cards to be labeled
//  @param    {Array} labels   The list of labels to be added
//  @return   {Promise} A promise representing labeling the list of cards
//    @fulfilled {integer} The number of cards successfully labeled
//    @rejected  {TypeError}  for a parameter of the incorrect type
function labelCards(cardData, labels) {
  const delayBetweenRequestsMS = cardData.length >= MAX_CARDS_PER_PAGE ? 1000 : 0

  if (delayBetweenRequestsMS) {
    console.log('INFO: A large number of label issue requests will be sent. Throttling requests.')
  }

  return new Promise((resolve, reject) => {
    if (!Array.isArray(cardData)) {
      reject(new TypeError('Param cardData must be an array'))
      return
    }

    if (!(cardData.length)) {
      resolve(0)
      return
    }

    if (!Array.isArray(labels)) {
      reject(new TypeError('Param labels must be an array'))
      return
    }

    let cardLabelAttemptCount = 0
    let cardsLabeledCount = 0
    let requestSentCount = 0

    const requestInterval = setInterval(() => {
      const card = cardData[requestSentCount]

      labelCardIssue(card, labels).then(() => {
        cardsLabeledCount++
      }).catch((e) => {
        console.warn(`WARNING: Failed to label card with id: ${card.id}`)
        console.warn(e.message)
      }).finally(() => {
        cardLabelAttemptCount++

        if (cardLabelAttemptCount === cardData.length) {
          resolve(cardsLabeledCount)
        }
      })

      if (++requestSentCount >= cardData.length) {
        clearInterval(requestInterval)
      }
    }, delayBetweenRequestsMS)
  })
}

async function main () {
  const validColumnsLabels = validateColumnsLabels(columns_labels)

  for (const column_labels of validColumnsLabels) {
    let columnId = column_labels['column_id']

    console.log(`Labeling a column with the following column label data: ${ JSON.stringify(column_labels) }`)

    if (!columnId) {
      let project

      try {
        project = await getProject(column_labels['project_name'])
      } catch (e) {
        console.error(`ERROR: Failed to find project with name "${column_labels['project_name']}"`)
        console.error('  Skipping labeling using the above data')
        console.error(e.message)

        continue
      }

      try {
        const column = await getColumn(column_labels['column_name'], project.id)
        columnId = column ? column.id : null

        if (!columnId) {
          throw new Error('')
        }
      } catch (e) {
        console.error(`ERROR: Failed to find column with name ${column_labels['column_name']}`)
        console.error('  Skipping labeling using the above data')
        console.error(e.message)

        continue
      }
    }

    let cards

    try {
      cards = await getColumnCardIssues(columnId)
    } catch (e) {
      console.error('ERROR: Failed to fetch card data')
      console.error('  Skipping labeling using the above data')
      console.error(e.message)

      continue
    }

    for (const card of cards) {
      const issueNumberMatchCapture = card.content_url.match(/\/issues\/(\d+)$/)

      if (!issueNumberMatchCapture || issueNumberMatchCapture.length < 2) {
        console.warn(`Failed to extract issue number from url: ${card.content_url}`)
        continue
      }

      const issueNumber = issueNumberMatchCapture[1]
      console.log(await getIssueLabels(issueNumber))
    }
    //const cardsLabeledCount = await labelCards(cards, column_labels['labels'])

    //console.log(`Labeled/relabeled ${cardsLabeledCount} of ${cards.length} card issues`)
  }

  return

  /*// Remove the label from the cards
  cards.data.forEach(async card => {
    const matches = card.content_url.match(/\/issues\/(\d+)/);

    if (!matches) {
      console.log(`Couldn't match the regexp against '${card.content_url}'.`);
      return true;
    }
    
    const issueNumber = matches[1];
    try {
      await octokit.issues.removeLabel({
        owner: repoOwner,
        repo: repo,
        issue_number: issueNumber,
        name: labelToRemove
      });
    }
    catch (e) {
      console.log(e.message);
      return true;
    }
  })*/
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
