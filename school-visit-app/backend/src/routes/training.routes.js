import { Router } from 'express';
import {
  createTrainingController,
  deleteTrainingController,
  exportTrainingsController,
  getTrainingsController,
  updateTrainingController,
} from '../controllers/training.controller.js';
import { requireUser } from '../middleware/auth.js';

const router = Router();

router.post('/', requireUser, createTrainingController);
router.get('/', requireUser, getTrainingsController);
router.get('/export', requireUser, exportTrainingsController);
router.patch('/:id', requireUser, updateTrainingController);
router.delete('/:id', requireUser, deleteTrainingController);

export default router;
