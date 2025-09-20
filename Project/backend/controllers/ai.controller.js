import * as ai from '../services/ai.service.js';

export const getResult = async (req, res) => {
  try {
    const { prompt } = req.query;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const result = await ai.generateResult(prompt);
    res.json({ message: result });
  } catch (error) {
    console.error('AI Controller Error:', error);
    res.status(500).json({ error: error.message });
  }
};
