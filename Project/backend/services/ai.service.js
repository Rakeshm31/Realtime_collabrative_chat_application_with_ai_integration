import { GoogleGenerativeAI } from "@google/generative-ai"

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_KEY);

const model = genAI.getGenerativeModel({
  model: "gemini-1.5-flash",
  generationConfig: {
    temperature: 0.4,
  },
  systemInstruction: `You are a helpful coding assistant for a collaborative MERN stack application. 

When users ask you to create code:
1. Always provide complete, working code examples
2. Include proper error handling
3. Use modern JavaScript/Node.js best practices
4. Explain what the code does briefly
5. Format code properly with comments

For Express server requests, provide complete server setup with routes, middleware, and error handling.
For React requests, provide functional components with hooks.
For general questions, be helpful and encouraging.

Keep responses concise but informative.`
});

// Enhanced fallback responses matching the demo
const getEnhancedFallback = (prompt) => {
  const lowerPrompt = prompt.toLowerCase();
  
  if (lowerPrompt.includes('express') || lowerPrompt.includes('server')) {
    return `This is the file structure for an Express server using ES6 modules. Remember to install Express: \`npm install express\`

Here's a complete Express server setup:

\`\`\`javascript
const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to the API!' });
});

app.post('/data', (req, res) => {
  try {
    const data = req.body;
    console.log('Received data:', data);
    res.status(201).json({ message: 'Data received successfully' });
  } catch (error) {
    console.error('Error processing data:', error);
    res.status(500).json({ error: 'Failed to process data' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

app.listen(port, () => {
  console.log(\`Server listening on port \${port}\`);
});
\`\`\`

This creates a basic Express server with CORS support, JSON parsing, error handling, and basic routes.`;
  }

  if (lowerPrompt.includes('hello')) {
    return `Hello, How can I help you today?

I can assist you with:
• Creating Express.js servers
• Building React components  
• Writing API endpoints
• Database integration
• Error handling
• Code optimization

Just ask me to create something specific!`;
  }

  return `I'm your AI coding assistant! I can help you build:

🚀 **Backend**: Express servers, APIs, middleware, authentication
⚛️ **Frontend**: React components, hooks, state management  
🗄️ **Database**: MongoDB, SQL queries, data modeling
🔧 **DevOps**: Deployment, environment setup, debugging

What would you like to create today?`;
};

export const generateResult = async (prompt) => {
  try {
    if (!process.env.GOOGLE_AI_KEY) {
      return getEnhancedFallback(prompt);
    }

    console.log('🤖 Generating AI response for:', prompt);
    
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    console.log('✅ AI Response generated successfully');
    
    return responseText;
    
  } catch (error) {
    console.error('🚨 AI Service Error:', error);
    
    if (error.status === 503) {
      return "🤖 AI is currently overloaded. Here's what I can help with offline:\n\n" + getEnhancedFallback(prompt);
    }
    
    return getEnhancedFallback(prompt);
  }
};
