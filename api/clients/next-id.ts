export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // Safe floor baseline is 3000 (safely above historical records GP-0001 to GP-0376 and development test records)
  const BASELINE_FLOOR = 3000;

  // In stateless serverless environments, provide a safe starting candidate ID
  const nextNum = BASELINE_FLOOR + 1;
  const nextId = `GP-${String(nextNum).padStart(4, '0')}`;

  return res.status(200).json({
    success: true,
    nextId,
    nextNum,
  });
}
