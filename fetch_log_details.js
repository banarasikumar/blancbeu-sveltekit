import fs from 'fs';
fetch('https://api.github.com/repos/banarasikumar/blancbeu-sveltekit/actions/runs?per_page=1')
  .then(res => res.json())
  .then(data => {
    const runId = data.workflow_runs[0].id;
    return fetch(`https://api.github.com/repos/banarasikumar/blancbeu-sveltekit/actions/runs/${runId}/jobs`);
  })
  .then(res => res.json())
  .then(jobs => {
    const jobId = jobs.jobs[0].id;
    return fetch(`https://api.github.com/repos/banarasikumar/blancbeu-sveltekit/actions/jobs/${jobId}/logs`);
  })
  .then(res => res.text())
  .then(text => {
    fs.writeFileSync('job_log.txt', text);
    console.log('Done writing log');
  }).catch(err => console.error(err));
