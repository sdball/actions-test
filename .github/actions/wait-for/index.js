const core = require('@actions/core');
const github = require('@actions/github');

const logFatal = (msg) => {
  console.log('::error::Error from wait-for');
  console.log(msg);
  return process.exit(1);
};

async function fetchCheckRuns(client, owner, repo, ref) {
  console.log('waitFor.fetchCheckRuns');
  const response = await client.checks.listForRef({
    owner,
    repo,
    ref,
  });
  return response.data.check_runs;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function checkComplete(client, owner, repo, ref, checkName, waitInterval) {
  const waitIntervalMillis = waitInterval * 1000;
  let waits = 0;
  while(true) {
    const allCheckRuns = await fetchCheckRuns(client, owner, repo, ref);
    console.log(allCheckRuns);

    const matchingCheck = allCheckRuns.filter(c => { return c.name == checkName });
    console.log(matchingCheck);

    const completed = matchingCheck.filter(c => { return c.status == 'completed' });
    if (completed.length) {
      console.log('Check completed');
      return completed[0];
    }
    waits += 1;
    console.log(`waitFor.checkComplete.sleeping ms=${waitIntervalMillis} waits=${waits}`);
    await sleep(waitIntervalMillis);
  }
}

async function run() {
  const githubToken = core.getInput('github_token', { required: true });
  const ref = core.getInput('ref', { required: true });
  const checkName = core.getInput('check_name', { required: true });
  const waitInterval = core.getInput('wait_interval');
  const allowedConclusions = core.getInput('allowed_conclusions').split(/,\s+/);

  console.log({
    githubToken,
    ref,
    checkName,
    waitInterval,
    allowedConclusions,
  });

  const octokit = github.getOctokit(githubToken);

  const [owner, repo] = process.env['GITHUB_REPOSITORY'].split('/');

  console.log(`waitFor.run.beginWait owner=${owner} repo=${repo} ref=${ref} check=${checkName} waitInterval=${waitInterval}`);
  console.log(`::group::waitFor ${checkName}`)
  const completed = await checkComplete(octokit.rest, owner, repo, ref, checkName, waitInterval);
  console.log('::endgroup::');
  console.log(`waitFor.run.finishWait owner=${owner} repo=${repo} ref=${ref} check=${checkName} waitInterval=${waitInterval}`);

  console.log(`waitFor.run.checkComplete conclusion=${completed.conclusion}`);
  if (allowedConclusions.includes(completed.conclusion)) {
    console.log('waitFor.run.conclusionAccepted');
    return;
  } else {
    console.log('waitFor.run.conclusionRejected');
    console.log(`::error::Rejected conclusion for ${checkName}`);
    return process.exit(1);
  }
}

run().catch((err) => {
  logFatal(err);
});
