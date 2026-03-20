import express, { Request, Response } from 'express';
import { TrainScraper } from './ScrappingService/trainScrapper';

const app = express();
const trainScraper = new TrainScraper();

app.use(express.json());

app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'OK' });
});

app.get('/schedule', async (req: Request, res: Response) => {
  try {
    const { from, to, date, time } = req.query;

    if (!from || !to || !date || !time) {
      return res.status(400).json({
        error: 'Missing required query parameters: from, to, date, time'
      });
    }

    const schedules = await trainScraper.getTrainSchedule(
      from as string,
      to as string,
      date as string,
      time as string
    );

    res.json(schedules);
  } catch (error) {
    console.error('Error fetching schedules:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default app;
