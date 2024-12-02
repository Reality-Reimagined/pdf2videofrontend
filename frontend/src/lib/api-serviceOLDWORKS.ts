import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5050',  // Updated to FastAPI's default port
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface VideoGenerationOptions {
  theme: string;
  addSubtitles: boolean;
}

interface VideoResponse {
  message: string;
  videoPath: string;
}

interface Video {
  title: string;
  description: string;
  videoPath: string;
  createdAt: string;
  hasSubtitles: boolean;
}

export const apiService = {
  async extractText(file: File): Promise<{ text: string }> {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post('http://localhost:5050/extract-text/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      // Ensure we have the expected response format
      if (!response.data || typeof response.data.text !== 'string') {
        console.error('Unexpected response format:', response.data);
        throw new Error('Invalid response format from server');
      }

      return response.data;
    } catch (error) {
      console.error('Error in extractText:', error);
      throw error;
    }
  },

  async generateScript(text: string): Promise<string> {
    const response = await api.post('/generate-script/', { text });
    return response.data.script;
  },

  async generateVideo(text: string, theme: string = 'default', addSubtitles: boolean = false): Promise<VideoResponse> {
    try {
      // 1. Generate TTS audio
      console.log('Generating speech...');
      const ttsResponse = await axios.post(
        'http://localhost:5050/text-to-speech/',
        { text },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      console.log('TTS Response:', ttsResponse.data);

      // 2. Get background video
      console.log('Getting background video...');
      const bgResponse = await axios.get(`http://localhost:5050/background-video/?query=${encodeURIComponent(theme)}`);
      console.log('Background Response:', bgResponse.data);

      // 3. Create base video
      console.log('Creating video...');
      const videoResponse = await axios.post('http://localhost:5050/create-video/');
      console.log('Video Response:', videoResponse.data);

      // 4. If subtitles are requested, generate and add them
      if (addSubtitles) {
        // Generate subtitles
        console.log('Generating subtitles...');
        const subtitlesResponse = await axios.post('http://localhost:5050/generate-subtitles/');
        console.log('Subtitles Response:', subtitlesResponse.data);

        // Add hard subtitles to video
        console.log('Adding subtitles to video...');
        const subtitledResponse = await axios.post('http://localhost:5050/add-hard-subtitles/');
        console.log('Subtitled Video Response:', subtitledResponse.data);

        return {
          message: "Video created successfully with subtitles",
          videoPath: "output_with_subtitles.mp4"
        };
      }

      return {
        message: "Video created successfully",
        videoPath: "output_video.mp4"
      };

    } catch (error) {
      console.error('Error in generateVideo:', error);
      if (error.response?.data) {
        console.error('Full error details:', {
          status: error.response.status,
          data: error.response.data,
          headers: error.response.headers
        });
      }
      throw error;
    }
  },

  async cleanup(): Promise<void> {
    try {
      await axios.post('http://localhost:5050/cleanup/');
    } catch (error) {
      console.error('Error in cleanup:', error);
      throw error;
    }
  },

  getVideos: async (): Promise<Video[]> => {
    try {
      const response = await axios.get('http://localhost:5050/videos/');
      return response.data;
    } catch (error) {
      console.error('Error getting videos:', error);
      throw error;
    }
  },

  logVideo: async (videoData: {
    title: string;
    description: string;
    videoPath: string;
    hasSubtitles: boolean;
  }) => {
    try {
      await axios.post('http://localhost:5050/videos/', {
        ...videoData,
        createdAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error logging video:', error);
      throw error;
    }
  }
};