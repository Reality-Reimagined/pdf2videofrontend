import axios from 'axios';
import { supabase } from './supabase';

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

  async generateVideo(text: string, theme: string = 'default', addSubtitles: boolean = false, title: string): Promise<VideoResponse> {
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

      // Get the current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      let finalVideoPath = addSubtitles ? 'output_with_subtitles.mp4' : 'output_video.mp4';
      
      // 4. If subtitles are requested, generate and add them
      if (addSubtitles) {
        console.log('Generating subtitles...');
        const subtitlesResponse = await axios.post('http://localhost:5050/generate-subtitles/');
        console.log('Subtitles Response:', subtitlesResponse.data);

        console.log('Adding subtitles to video...');
        const subtitledResponse = await axios.post('http://localhost:5050/add-hard-subtitles/');
        console.log('Subtitled Video Response:', subtitledResponse.data);
      }

      // Upload the video to Supabase storage
      const fileName = `${user.id}/${Date.now()}-${theme}-video.mp4`;
      const videoFile = await fetch(`http://localhost:5050/videos/${finalVideoPath}`).then(res => res.blob());
      
      const { data: storageData, error: storageError } = await supabase
        .storage
        .from('pdf2socialmediavideos')
        .upload(fileName, videoFile);

      if (storageError) throw storageError;

      // Get public URL
      const { data: { publicUrl } } = supabase
        .storage
        .from('pdf2socialmediavideos')
        .getPublicUrl(fileName);

      // Save video record in the database
      const { data: videoData, error: dbError } = await supabase
        .from('videos')
        .insert([{
          user_id: user.id,
          title: title,
          url: publicUrl,
          created_at: new Date().toISOString(),
          duration: 0, // You might want to calculate this
          thumbnail: '', // Optional: Add thumbnail generation
          has_subtitles: addSubtitles
        }])
        .select()
        .single();

      if (dbError) throw dbError;

      return {
        message: "Video created successfully",
        videoPath: publicUrl
      };

    } catch (error) {
      console.error('Error in generateVideo:', error);
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
      const response = await axios.post('http://localhost:5050/log-video', videoData);
      return response.data;
    } catch (error) {
      console.error('Error logging video:', error);
      throw error;
    }
  }
};