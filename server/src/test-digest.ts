import aiDigestService from '@/modules/ai/ai-digest.service';

async function run() {
  const report = await aiDigestService.generateDigestForOrg(
    'PASTE_A_REAL_ORG_ID_HERE',
    'Test Org',
  );
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

run();