
import React from 'react';
import { useVideoStore } from '../lib/store';
import { useAuthStore } from '../lib/store';

export const ThemeInput = () => {
  const { theme, setTheme } = useVideoStore();
  const { user } = useAuthStore();
  
  // Debug logging to check subscription status
  console.log('User subscription:', user?.subscription?.plan);
  
  // Check if user exists and has an active subscription
  if (!user || !user.subscription || user.subscription.plan === 'free') {
    console.log('Hiding theme input - user is on free plan or not subscribed');
    return null;
  }

  // Only show for pro/enterprise plans
  if (!['pro', 'enterprise'].includes(user.subscription.plan)) {
    console.log('Hiding theme input - user is not on pro or enterprise plan');
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="theme" className="text-sm font-medium text-gray-700">
        Background Theme
      </label>
      <input
        id="theme"
        type="text"
        value={theme}
        onChange={(e) => setTheme(e.target.value)}
        className="rounded-md border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        placeholder="Enter theme (e.g., city, nature)"
      />
      <p className="text-xs text-gray-500">
        {user.subscription.plan === 'enterprise' 
          ? 'Enterprise users can use any theme'
          : 'Pro users can customize video themes'}
      </p>
    </div>
  );
};

// import React from 'react';
// import { useAuthStore } from '../lib/store';

// export const ThemeInput = () => {
//   const { theme, setTheme } = useStore();

//   return (
//     <div className="flex flex-col gap-2">
//       <label htmlFor="theme" className="text-sm font-medium text-gray-700">
//         Background Theme
//       </label>
//       <input
//         id="theme"
//         type="text"
//         value={theme}
//         onChange={(e) => setTheme(e.target.value)}
//         className="rounded-md border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
//         placeholder="Enter theme (e.g., city, nature)"
//       />
//     </div>
//   );
// };
