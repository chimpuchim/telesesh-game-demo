import { Router } from 'express';
import { GameNotFoundError, listGameIds, loadGameConfig } from './gameRepository.js';

export const gamesRouter = Router();

gamesRouter.get('/games', async (_req, res, next) => {
  try {
    const ids = await listGameIds();
    const games = await Promise.all(ids.map((id) => loadGameConfig(id)));
    res.json(games.map(({ gameId, template, title, theme }) => ({ gameId, template, title, themeName: theme.name })));
  } catch (err) {
    next(err);
  }
});

gamesRouter.get('/games/:gameId', async (req, res, next) => {
  try {
    res.json(await loadGameConfig(req.params.gameId));
  } catch (err) {
    if (err instanceof GameNotFoundError) {
      res.status(404).json({ error: err.message });
      return;
    }
    next(err);
  }
});
