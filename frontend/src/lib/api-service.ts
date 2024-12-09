import axios from 'axios';
import { supabase } from './supabase';

// const frontend = "https://super-sloth-deep.ngrok-free.app";
const api = axios.create({
  // baseURL: 'https://loon-stirred-terribly.ngrok-free.app',  // Updated to FastAPI's default port
  baseURL: 'https://super-sloth-deep.ngrok-free.app',
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true'
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
      // const response = await axios.post('https://loon-stirred-terribly.ngrok-free.app/extract-text/', formData, {
      const response = await axios.post('https://super-sloth-deep.ngrok-free.app/extract-text/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'ngrok-skip-browser-warning': 'true'
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
        // 'https://loon-stirred-terribly.ngrok-free.app/text-to-speech/',
        'https://https://super-sloth-deep.ngrok-free.app/text-to-speech/',
        { text },
        {
          headers: {
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true'
          }
        }
      );
      console.log('TTS Response:', ttsResponse.data);

      // 2. Get background video
      console.log('Getting background video...');
      const bgResponse = await axios.get(`https://super-sloth-deep.ngrok-free.app/background-video/?query=${encodeURIComponent(theme)}`);
      console.log('Background Response:', bgResponse.data);

      // 3. Create base video
      console.log('Creating video...');
      const videoResponse = await axios.post('https://super-sloth-deep.ngrok-free.app/create-video/');
      console.log('Video Response:', videoResponse.data);

      // Get the current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      let finalVideoPath = addSubtitles ? 'output_with_subtitles.mp4' : 'output_video.mp4';
      
      // 4. If subtitles are requested, generate and add them
      if (addSubtitles) {
        console.log('Generating subtitles...');
        const subtitlesResponse = await axios.post('https://super-sloth-deep.ngrok-free.app/generate-subtitles/');
        console.log('Subtitles Response:', subtitlesResponse.data);

        console.log('Adding subtitles to video...');
        const subtitledResponse = await axios.post('https://super-sloth-deep.ngrok-free.app/add-hard-subtitles/');
        console.log('Subtitled Video Response:', subtitledResponse.data);
      }

      // Upload the video to Supabase storage
      const fileName = `${user.id}/${Date.now()}-${theme}-video.mp4`;

      // Modify the fetch request to explicitly handle binary data
      const videoFile = await fetch(`https://super-sloth-deep.ngrok-free.app/videos/${addSubtitles ? 'output_with_subtitles.mp4' : 'output_video.mp4'}`, {
        headers: {
          'Accept': 'video/mp4,video/*',
          'ngrok-skip-browser-warning': 'true'
        }
      })
      .then(async (response) => {
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to fetch video: ${response.statusText} - ${errorText}`);
        }
        const blob = await response.blob();
        // Force the correct MIME type
        return new Blob([blob], { type: 'video/mp4' });
      })
      .catch((error) => {
        console.error('Error fetching video file:', error);
        throw error;
      });

      console.log('Video file type:', videoFile.type);  // Should show 'video/mp4'
      console.log('Video file size:', videoFile.size);  // Log the size for debugging

      // Modified Supabase upload with explicit content type
      const { data: storageData, error: storageError } = await supabase
        .storage
        .from('pdf2socialmediavideos')
        .upload(fileName, videoFile, {
          contentType: 'video/mp4',  // Explicitly set the content type
          cacheControl: '3600',
          upsert: false
        });

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
      await axios.post('https://super-sloth-deep.ngrok-free.app/cleanup/');
    } catch (error) {
      console.error('Error in cleanup:', error);
      throw error;
    }
  },

  getVideos: async (): Promise<Video[]> => {
    try {
      const response = await axios.get('https://super-sloth-deep.ngrok-free.app/videos/');
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
      const response = await axios.post('https://super-sloth-deep.ngrok-free.app/log-video', videoData);
      return response.data;
    } catch (error) {
      console.error('Error logging video:', error);
      throw error;
    }
  }
};
