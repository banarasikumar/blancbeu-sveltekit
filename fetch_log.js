import fs from 'fs';
fetch('https://api.github.com/repos/banarasikumar/blancbeu-sveltekit/actions/runs?per_page=1')
  .then(res => res.json())
  .then(data => {
    const runId = data.workflow_runs[0].id;
    return fetch(`https://api.github.com/repos/banarasikumar/blancbeu-sveltekit/actions/runs/${runId}/jobs`);
  })
  .then(res => res.json())
  .then(jobs => {
    const failedSteps = jobs.jobs[0].steps.filter(s => s.conclusion === 'failure');
    console.log(failedSteps);
  }).catch(err => console.error(err));
