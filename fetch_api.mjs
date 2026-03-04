fetch('http://localhost:3000/api/jobs?radius=20').then(res => res.json()).then(jobs => {
    console.log(`Total jobs: ${jobs.length}`);
    const spJobs = jobs.filter(j => j.source.includes('Service Public'));
    console.log('SP jobs:', spJobs.map(j => j.title));
});
