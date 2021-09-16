const core = require('@actions/core');
const github = require('@actions/github');

const logFatal = (msg) => {
  console.log('::error::Error from wait-for');
  console.log(msg);
  return process.exit(1);
};

const fetchCurrentRun = async (octokit, owner, repo) => {
  const runId = process.env['GITHUB_RUN_ID'];
  let response;
  try {
    response = await octokit.rest.actions.getWorkflowRun({
      owner,
      repo,
      run_id: runId,
    });
  } catch (err) {
    logFatal('Failed to query current workflow run');
  }
  core.debug('Current Run');
  core.debug(response.data);
  return response.data;
};

const fetchWorkflowRuns = async (octokit, owner, repo, branch, workflowFile, status) => {
  core.info(`fetchWorkflowRuns.listWorkflowRuns branch.${branch} status.${status}`);
  const params = {
      owner,
      repo,
      workflow_id: workflowFile,
      branch,
      status,
      per_page: 3, // we only need to check to see if there are matching runs
  };
  core.debug(params);
  let response;
  try {
    response = await octokit.rest.actions.listWorkflowRuns(params);
  } catch (err) {
    logFatal('Failed to query workflow runs');
  }
  core.debug(response.data);
  return response.data;
}

async function cancelWorkflowRun(octokit, owner, repo, runId) {
  core.info(`Cancelling workflow run ${runId}`);
  const response = await octokit.rest.actions.cancelWorkflowRun({
    owner,
    repo,
    run_id: runId,
  });
  core.debug(response);
  core.setOutput('this_run_cancelled', true);
}

async function run() {
  const githubToken = core.getInput('github_token', { required: true });
  const ref = core.getInput('ref', { required: true });
  const checkName = core.getInput('check_name', { required: true });
  const waitInterval = core.getInput('wait_interval');

  console.log({
    githubToken,
    ref,
    checkName,
    waitInterval,
  });

  const octokit = github.getOctokit(githubToken);

  const [owner, repo] = process.env['GITHUB_REPOSITORY'].split('/');

  const response = await octokit.rest.checks.listForRef({
    owner,
    repo,
    ref,
  });

  console.log(response.data);

  // const currentRun = await fetchCurrentRun(octokit, owner, repo);

  // // if ANY kind of workflow run follows this run then we'll cancel because we're out of date
  // const queuedWorkflowRuns = await fetchWorkflowRuns(octokit, owner, repo, currentRun.head_branch, workflowFile, 'queued');
  // const inProgressWorkflowRuns = await fetchWorkflowRuns(octokit, owner, repo, currentRun.head_branch, workflowFile, 'in_progress');
  // const completedWorkflowRuns = await fetchWorkflowRuns(octokit, owner, repo, currentRun.head_branch, workflowFile, 'completed');

  // const followingRunIds = [
  //   ...queuedWorkflowRuns.workflow_runs,
  //   ...inProgressWorkflowRuns.workflow_runs,
  //   ...completedWorkflowRuns.workflow_runs,
  // ].map(r => r.id).filter(id => id > currentRun.id);

  // core.info(`THIS is Build ${currentRun.run_number} / Run ${currentRun.id}`);

  // if (followingRunIds.length > 0) {
  //   core.info(`Following run IDs are ${followingRunIds}`);
  //   // there are queued runs after this one
  //   // we only cancel ourselves to avoid edges like cancelling later runs that SHOULD run
  //   core.info('There are following runs so we are out of date: cancelling this run');
  //   await cancelWorkflowRun(octokit, owner, repo, currentRun.id);
  // } else {
  //   core.info('Did not find any following runs: proceeding with this run');
  // }
}

run().catch((err) => {
  logFatal(err);
});
