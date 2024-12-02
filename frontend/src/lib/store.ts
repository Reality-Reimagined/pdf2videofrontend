import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!, 
  import.meta.env.VITE_SUPABASE_ANON_KEY!
)

interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  subscription: {
    plan: 'free' | 'pro' | 'enterprise';
    status: 'active' | 'inactive' | 'cancelled';
    validUntil: string;
  };
  apiKeys: {
    openai?: string;
    groq?: string;
    gemini?: string;
    together?: string;
  };
  settings: {
    notifications: boolean;
    theme: 'light' | 'dark';
    defaultModel: string;
  };
}

interface Video {
  id: string;
  user_id: string;
  title: string;
  url: string;
  created_at: string;
  duration?: number;
  thumbnail?: string;
  has_subtitles: boolean;
}

interface VideoState {
  selectedModel: string;
  theme: string;
  addSubtitles: boolean;
  isProcessing: boolean;
  videos: Video[];
  setSelectedModel: (model: string) => void;
  setTheme: (theme: string) => void;
  setAddSubtitles: (value: boolean) => void;
  setIsProcessing: (value: boolean) => void;
  refreshVideos: () => Promise<void>;
}

interface AuthState {
  user: User | null;
  videos: Video[];
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  updateUser: (data: Partial<User>) => void;
  addVideo: (video: Video) => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      videos: [],
      isAuthenticated: false,
      isLoading: false,
      login: async (email, password) => {
        set({ isLoading: true });
        try {
          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
          });

          if (error) throw error;

          set({ 
            user: {
              id: data.user?.id || '',
              email: data.user?.email || '',
              name: data.user?.user_metadata?.full_name || '',
              subscription: {
                plan: 'free',
                status: 'active',
                validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
              },
              apiKeys: {},
              settings: {
                notifications: true,
                theme: 'light',
                defaultModel: 'groq',
              },
            }, 
            isAuthenticated: true 
          });
        } catch (error) {
          console.error('Login error:', error);
          throw error;
        } finally {
          set({ isLoading: false });
        }
      },
      register: async (email, password, name) => {
        set({ isLoading: true });
        try {
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: {
                full_name: name
              }
            }
          });

          if (error) throw error;

          set({ 
            user: {
              id: data.user?.id || '',
              email: data.user?.email || '',
              name,
              subscription: {
                plan: 'free',
                status: 'active',
                validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
              },
              apiKeys: {},
              settings: {
                notifications: true,
                theme: 'light',
                defaultModel: 'groq',
              },
            }, 
            isAuthenticated: true 
          });
        } catch (error) {
          console.error('Registration error:', error);
          throw error;
        } finally {
          set({ isLoading: false });
        }
      },
      logout: async () => {
        try {
          await supabase.auth.signOut();
          set({ user: null, isAuthenticated: false });
        } catch (error) {
          console.error('Logout error:', error);
          throw error;
        }
      },
      updateUser: (data) => {
        set((state) => ({
          user: state.user ? { ...state.user, ...data } : null,
        }));
      },
      addVideo: async (video) => {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error('No user found');

          // Upload video to storage if it's a file
          let videoUrl = video.url;
          if (video.file) {
            const fileName = `${user.id}/${Date.now()}-${video.title}.mp4`;
            const { data: storageData, error: storageError } = await supabase
              .storage
              .from('pdf2socialmediavideos')
              .upload(fileName, video.file);

            if (storageError) throw storageError;
            
            // Get public URL for the uploaded video
            const { data: { publicUrl } } = supabase
              .storage
              .from('pdf2socialmediavideos')
              .getPublicUrl(fileName);
            
            videoUrl = publicUrl;
          }

          const videoData = {
            user_id: user.id,
            title: video.title,
            url: videoUrl,
            duration: video.duration,
            thumbnail: video.thumbnail,
            created_at: new Date().toISOString(),
            has_subtitles: video.has_subtitles
          };

          const { data, error } = await supabase
            .from('videos')
            .insert([videoData])
            .select()
            .single();

          if (error) throw error;

          set((state) => ({
            videos: [data, ...state.videos],
          }));
        } catch (error) {
          console.error('Error adding video:', error);
          throw error;
        }
      },
    }),
    {
      name: 'auth-storage',
    }
  )
);

export const useVideoStore = create<VideoState>((set) => ({
  selectedModel: 'groq',
  theme: 'city',
  addSubtitles: true,
  isProcessing: false,
  videos: [],
  setSelectedModel: (model) => set({ selectedModel: model }),
  setTheme: (theme) => set({ theme }),
  setAddSubtitles: (value) => set({ addSubtitles: value }),
  setIsProcessing: (value) => set({ isProcessing: value }),
  refreshVideos: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      const { data, error } = await supabase
        .from('videos')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      set({ videos: data || [] });
    } catch (error) {
      console.error('Error fetching videos:', error);
      throw error;
    }
  }
}));
