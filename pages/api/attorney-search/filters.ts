import type { NextApiRequest, NextApiResponse } from 'next';
import { getAttorneySearchFilterOptions } from 'src/lib/chat/attorney-search';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const options = await getAttorneySearchFilterOptions();
    return res.status(200).json(options);
  } catch (err) {
    console.error('[attorney-search/filters] failed:', err);
    return res
      .status(500)
      .json({ error: 'Failed to load filter options', practices: [], locations: [] });
  }
}
