import axios from 'axios';

export const aiService = {
  generateScript: async (text: string, model: string = 'groq') => {
    try {
      console.log('Sending request with:', { text, model });
      // const response = await axios.post('http://localhost:5050/generate-script/', {
      
      const response = await axios.post('https://loon-stirred-terribly.ngrok-free.app/generate-script/', {
        text: text,
        model: model.toLowerCase()
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      console.log('Response:', response.data);
      
      if (!response.data || !response.data.script) {
        throw new Error('Invalid response format from server');
      }

      return response.data.script;
    } catch (error) {
      console.error('Full error details:', error.response?.data);
      throw new Error('Failed to generate script. Please try again later.');
    }
  }
};