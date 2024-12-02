import { supabase } from './supabase';

export const socialService = {
  async handleFacebookCallback(code: string) {
    try {
      // Exchange code for access token
      const tokenResponse = await fetch('https://graph.facebook.com/v12.0/oauth/access_token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: import.meta.env.VITE_FACEBOOK_APP_ID,
          client_secret: import.meta.env.VITE_FACEBOOK_APP_SECRET,
          code,
          redirect_uri: `${window.location.origin}/auth/facebook/callback`,
        }),
      });

      const tokenData = await tokenResponse.json();
      
      // Get user profile
      const profileResponse = await fetch(`https://graph.facebook.com/me?access_token=${tokenData.access_token}`);
      const profileData = await profileResponse.json();

      // Save to Supabase
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      const { error } = await supabase
        .from('social_accounts')
        .upsert({
          user_id: user.id,
          platform: 'facebook',
          username: profileData.name,
          access_token: tokenData.access_token,
          token_expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error handling Facebook callback:', error);
      throw error;
    }
  },

  // Add similar methods for other platforms
};

export const tiktokService = {
  async checkAuth() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data: account } = await supabase
      .from('social_accounts')
      .select('access_token')
      .eq('user_id', user.id)
      .eq('platform', 'tiktok')
      .single();

    return !!account;
  },

  async uploadVideo(videoUrl: string, description: string) {
    try {
      // First check if we're authenticated
      const isAuthed = await this.checkAuth();
      if (!isAuthed) {
        throw new Error('TikTok account not connected');
      }

      // Rest of your existing upload code...
      const { data: { user } } = await supabase.auth.getUser();
      const { data: account } = await supabase
        .from('social_accounts')
        .select('access_token')
        .eq('user_id', user.id)
        .eq('platform', 'tiktok')
        .single();

      // Create video using pull_by_url
      const createResponse = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${account.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          post_info: {
            title: description,
            privacy_level: 'PRIVATE', // or 'PUBLIC'
            disable_duet: false,
            disable_comment: false,
            disable_stitch: false
          },
          source_info: {
            source: 'PULL_FROM_URL',
            video_url: videoUrl
          }
        })
      });

      const initData = await createResponse.json();
      if (!initData.data || !initData.data.publish_id) {
        throw new Error('Failed to initialize video upload');
      }

      // Check upload status
      const statusResponse = await fetch(`https://open.tiktokapis.com/v2/post/publish/status/fetch/?publish_id=${initData.data.publish_id}`, {
        headers: {
          'Authorization': `Bearer ${account.access_token}`
        }
      });

      const statusData = await statusResponse.json();
      return statusData;

    } catch (error) {
      console.error('Error uploading to TikTok:', error);
      throw error;
    }
  }
}; 