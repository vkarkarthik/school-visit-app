import { asyncHandler } from '../utils/asyncHandler.js';
import { getSchoolMaster } from '../services/sheets.service.js';

export const getSchoolMasterController = asyncHandler(async (req, res) => {
  const data = await getSchoolMaster();
  res.json({ success: true, ...data });
});