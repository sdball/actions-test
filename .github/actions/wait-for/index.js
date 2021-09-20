const core = require('@actions/core');
const github = require('@actions/github');

const logFatal = (msg) => {
  console.log('::error::Error from wait-for');
  console.log(msg);
  return process.exit(1);
};

async function fetchJobsForWorkflowRun(client, owner, repo) {
  console.log('waitFor.fetchJobsForWorkflowRun');
  console.log('wait.fetchJobsForWorkflowRun.calling API actions.listJobsForWorkflowRun');
  const response = await client.actions.listJobsForWorkflowRun({
    owner,
    repo,
    run_id: process.env['GITHUB_RUN_ID'],
  });
  return response.data.jobs;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function checkComplete(client, owner, repo, jobName, waitInterval) {
  const waitIntervalMillis = waitInterval * 1000;
  let waits = 0;
  while(true) {
    const jobsForWorkflowRun = await fetchJobsForWorkflowRun(client, owner, repo);
    if (! jobsForWorkflowRun.length) {
      console.log('::error::Did not find any jobs from the current workflow run');
      process.exit(1);
    }
    console.log(`waitFor.checkComplete.jobsForWorkflowRun count=${jobsForWorkflowRun.length}`);

    const matchingJob = jobsForWorkflowRun.filter(job => { return job.name == jobName });
    if (! matchingJob.length) {
      console.log(`::error::Did not find any job with the name "${jobName}"`);
      process.exit(1);
    }
    console.log(`waitFor.checkComplete.matchingJob name="${jobName}" count=${matchingJob.length}`);

    const completed = matchingJob.filter(job => { return job.status == 'completed' });
    if (completed.length) {
      console.log('waitFor.checkComplete.completed');
      return completed[0];
    }
    waits += 1;
    console.log(`waitFor.checkComplete.sleeping ms=${waitIntervalMillis} waits=${waits}`);
    await sleep(waitIntervalMillis);
  }
}

async function run() {
  const githubToken = core.getInput('github_token', { required: true });
  const jobName = core.getInput('job_name', { required: true });
  const waitInterval = core.getInput('wait_interval');
  const allowedConclusions = core.getInput('allowed_conclusions').split(/,\s+/);

  console.log({
    githubToken,
    jobName,
    waitInterval,
    allowedConclusions,
  });

  const octokit = github.getOctokit(githubToken);

  const [owner, repo] = process.env['GITHUB_REPOSITORY'].split('/');

  console.log(`waitFor.run.beginWait owner="${owner}" repo="${repo}" check="${jobName}" waitInterval="${waitInterval}"`);
  console.log(`::group::waitFor "${jobName}" to complete`)
  const completed = await checkComplete(octokit.rest, owner, repo, jobName, waitInterval);
  console.log('::endgroup::');
  console.log('waitFor.run.finishWait');

  console.log(`waitFor.run.checkComplete conclusion="${completed.conclusion}"`);
  if (allowedConclusions.includes(completed.conclusion)) {
    console.log('waitFor.run.conclusionAccepted');
    return;
  } else {
    console.log('waitFor.run.conclusionRejected');
    console.log(`::error::Rejected conclusion for "${jobName}"`);
    return process.exit(1);
  }
}

run().catch((err) => {
  logFatal(err);
});
