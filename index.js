const core = require('@actions/core');
const github = require('@actions/github');
const token = core.getInput('token');
const labelToRemove = core.getInput('label_to_remove');
const columnId = core.getInput('column_id');
const repoOwner = github.context.repo.owner;
const repo = github.context.repo.repo;
const octokit = github.getOctokit(token);

async function main() {
  // Get the cards from the given column
  var cards = null;
  try {
    cards = await octokit.projects.listCards({
      column_id: columnId,
      archived_state: 'not_archived'
    });
  }
  catch (e) {
    console.log(e.message);
    return;
  }

  // Remove the label from the cards
  cards.data.forEach(async card => {
    if (!card.content_url) {
      // This occurs for notes, where the card is not an issue
      return true;
    }
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
  });
}

main();
