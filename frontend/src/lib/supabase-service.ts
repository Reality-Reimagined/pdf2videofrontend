import { supabase } from './supabase';

export interface UserProfile {
  id: string;
  username: string;
  email: string;
}

export interface ApiKey {
  provider: string;
  api_key: string;
}

export interface GeneratedVideo {
  id: string;
  title: string;
  description: string;
  video_path: string;
  has_subtitles: boolean;
  theme: string;
  model_used: string;
  created_at: string;
}

export interface Video {
  id: string;
  user_id: string;
  title: string;
  url: string;
  created_at: string;
  duration?: number;
  thumbnail?: string;
  has_subtitles: boolean;
}

export const supabaseService = {
  // Profile operations
  async getProfile(userId: string) {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error) throw error;
    return data;
  },

  async updateProfile(userId: string, updates: Partial<UserProfile>) {
    const { data, error } = await supabase
      .from('user_profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // API Keys operations
  async saveApiKey(userId: string, provider: string, apiKey: string) {
    const { data, error } = await supabase
      .from('user_api_keys')
      .upsert({
        user_id: userId,
        provider,
        api_key: apiKey
      }, {
        onConflict: 'user_id,provider'
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async getApiKeys(userId: string) {
    const { data, error } = await supabase
      .from('user_api_keys')
      .select('provider, api_key')
      .eq('user_id', userId);
    
    if (error) throw error;
    return data;
  },

  // Video operations
  async saveGeneratedVideo(videoData: {
    user_id: string;
    title: string;
    description: string;
    video_path: string;
    has_subtitles: boolean;
    theme: string;
    model_used: string;
  }) {
    console.log('Attempting to save video:', videoData);
    const { data, error } = await supabase
      .from('generated_videos')
      .insert(videoData)
      .select()
      .single();
    
    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }
    return data;
  },

  async getUserVideos(userId: string) {
    const { data, error } = await supabase
      .from('generated_videos')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  // Delete video
  async deleteVideo(videoId: string) {
    try {
      // First get the video details
      const { data: video } = await supabase
        .from('videos')
        .select('url, user_id')
        .eq('id', videoId)
        .single();

      if (!video) throw new Error('Video not found');

      // Extract the file path from the URL
      const urlParts = video.url.split('/');
      const fileName = urlParts.pop();
      if (!fileName) throw new Error('Invalid video URL');

      // Construct the full path including user_id
      const filePath = `${video.user_id}/${fileName}`;

      console.log('Deleting file:', filePath); // Debug log

      // Delete from storage
      const { error: storageError } = await supabase
        .storage
        .from('pdf2socialmediavideos')
        .remove([filePath]);

      if (storageError) {
        console.error('Storage delete error:', storageError);
        throw storageError;
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from('videos')
        .delete()
        .eq('id', videoId);

      if (dbError) throw dbError;

      return true;
    } catch (error) {
      console.error('Error in deleteVideo:', error);
      throw error;
    }
  },

  // Update video title
  async updateVideoTitle(videoId: string, newTitle: string) {
    try {
      // First get the current video details
      const { data: video } = await supabase
        .from('videos')
        .select('url, user_id')
        .eq('id', videoId)
        .single();

      if (!video) throw new Error('Video not found');

      // Parse the URL to get the file path components
      const urlParts = video.url.split('/');
      const oldFileName = urlParts.pop();
      if (!oldFileName) throw new Error('Invalid video URL');

      // Extract timestamp
      const timestamp = oldFileName.split('-')[0];
      const newFileName = `${timestamp}-${newTitle.toLowerCase().replace(/\s+/g, '-')}.mp4`;
      
      // Construct the full paths including user_id
      const oldPath = `${video.user_id}/${oldFileName}`;
      const newPath = `${video.user_id}/${newFileName}`;

      console.log('Processing file update:', {
        oldPath,
        newPath,
        videoId
      });

      // Copy the file with new name
      const { error: copyError } = await supabase
        .storage
        .from('pdf2socialmediavideos')
        .copy(oldPath, newPath);

      if (copyError) {
        console.error('Copy error:', copyError);
        throw copyError;
      }

      // Get the new public URL
      const { data: { publicUrl: newUrl } } = supabase
        .storage
        .from('pdf2socialmediavideos')
        .getPublicUrl(newPath);

      // Update the database record
      const { error: updateError } = await supabase
        .from('videos')
        .update({
          title: newTitle,
          url: newUrl
        })
        .match({ id: videoId });

      if (updateError) {
        // If database update fails, clean up the new file
        await supabase
          .storage
          .from('pdf2socialmediavideos')
          .remove([newPath]);
        throw updateError;
      }

      // Delete the old file after successful update
      const { error: deleteError } = await supabase
        .storage
        .from('pdf2socialmediavideos')
        .remove([oldPath]);

      if (deleteError) {
        console.error('Warning: Could not delete old file:', deleteError);
      }

      // Verify the update
      const { data: updatedVideo, error: verifyError } = await supabase
        .from('videos')
        .select('*')
        .eq('id', videoId)
        .single();

      if (verifyError || !updatedVideo) {
        throw new Error('Failed to verify update');
      }

      console.log('Update completed successfully:', {
        oldFile: oldPath,
        newFile: newPath,
        newUrl,
        updatedVideo
      });

      return updatedVideo;
    } catch (error) {
      console.error('Error in updateVideoTitle:', error);
      throw error;
    }
  }
}; 