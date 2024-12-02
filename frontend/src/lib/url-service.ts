import { supabase } from './supabase';

export const createShortUrl = async (videoId: string, originalUrl: string) => {
  try {
    // First generate a short code
    const { data: shortCodeData, error: shortCodeError } = await supabase
      .rpc('generate_short_code');

    if (shortCodeError) throw shortCodeError;

    // Then create the short URL entry
    const { data, error } = await supabase
      .from('short_urls')
      .insert({
        video_id: videoId,
        original_url: originalUrl,
        short_code: shortCodeData
      })
      .select('short_code')
      .single();

    if (error) throw error;

    // Return the shortened URL
    return `${window.location.origin}/v/${data.short_code}`;
  } catch (error) {
    console.error('Error creating short URL:', error);
    return originalUrl; // Fallback to original URL
  }
}; 