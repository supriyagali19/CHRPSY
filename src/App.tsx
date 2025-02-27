import React, { useState, useEffect, useRef } from 'react';
import { ImageIcon, Loader2, Sparkles, XCircle, Settings, Sun, Moon, Wand2, Maximize2, AlertTriangle, Lock, Timer } from 'lucide-react';

// Define the options interface
interface GenerationOptions {
  num_inference_steps: number;
  guidance_scale: number;
  width: number;
  height: number;
  refiner_steps: number;
}

function App() {
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState(' ');
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [securityWarning, setSecurityWarning] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [lockDuration, setLockDuration] = useState(5); // Default 5 minutes
  const [remainingTime, setRemainingTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [windowSwitchCount, setWindowSwitchCount] = useState(0);
  
  // Define options state with default values
  const [options, setOptions] = useState<GenerationOptions>({
    num_inference_steps: 0,
    guidance_scale: 0,
    width: 768,
    height: 768,
    refiner_steps: 0
  });

  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' ||
        (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });

  useEffect(() => {
    // Create audio element with a reliable source that loops
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    audio.preload = 'auto';
    audio.volume = 1.0; // Set volume to 100%
    audio.loop = true; // Enable looping
    audioRef.current = audio;

    // Test audio loading
    const handleCanPlayThrough = () => {
      console.log('Audio loaded successfully');
    };

    const handleError = (e: Event) => {
      console.error('Error loading audio:', e);
      setError('Failed to load alarm sound. Please check your internet connection.');
    };

    audio.addEventListener('canplaythrough', handleCanPlayThrough);
    audio.addEventListener('error', handleError);
    
    // Optional: Preload the audio
    const loadAudio = async () => {
      try {
        await audio.load();
      } catch (err) {
        console.error('Error preloading audio:', err);
      }
    };
    loadAudio();
    
    return () => {
      audio.removeEventListener('canplaythrough', handleCanPlayThrough);
      audio.removeEventListener('error', handleError);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  useEffect(() => {
    if (isLocked && remainingTime > 0) {
      timerRef.current = setInterval(() => {
        setRemainingTime(prev => {
          if (prev <= 1) {
            setIsLocked(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isLocked, remainingTime]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && isLocked) {
        setSecurityWarning('Tab switching detected! Please return to this tab immediately!');
        if (audioRef.current) {
          // Force unmute and set volume to maximum
          audioRef.current.muted = false;
          audioRef.current.volume = 1.0;
          
          // Play audio with proper error handling
          const playSound = async () => {
            try {
              // Create a new AudioContext to ensure audio plays
              const audioContext = new AudioContext();
              await audioContext.resume();
              
              // Attempt to play with retry mechanism
              const attemptPlay = async (retries = 3) => {
                try {
                  await audioRef.current?.play();
                } catch (err) {
                  if (retries > 0) {
                    console.log(`Retrying playback, ${retries} attempts remaining`);
                    setTimeout(() => attemptPlay(retries - 1), 1000);
                  } else {
                    console.error('Failed to play audio after all retries:', err);
                  }
                }
              };
              
              await attemptPlay();
            } catch (err) {
              console.error('Error playing audio:', err);
              // Try playing again after user interaction
              const handleUserInteraction = async () => {
                try {
                  await audioRef.current?.play();
                  document.removeEventListener('click', handleUserInteraction);
                } catch (err) {
                  console.error('Error playing audio after user interaction:', err);
                }
              };
              document.addEventListener('click', handleUserInteraction);
            }
          };
          playSound();
        }
      } else if (!document.hidden) {
        // Only stop the alarm when returning to the tab
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        }
        setSecurityWarning(null);
      }
    };

    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
      if (!document.fullscreenElement && isLocked) {
        setSecurityWarning('Full-screen mode is required!');
      } else {
        setSecurityWarning(null);
      }
    };

    const preventDefaultKeys = (e: KeyboardEvent) => {
      if (isLocked) {
        if (
          e.key === 'F11' ||
          (e.ctrlKey && (e.key === 'r' || e.key === 'R')) ||
          (e.altKey && e.key === 'Tab') ||
          (e.ctrlKey && e.key === 'Tab') ||
          (e.altKey && e.key === 'F4')
        ) {
          e.preventDefault();
        }
      }
    };

    const preventCopyPaste = (e: Event) => {
      if (isLocked) {
        e.preventDefault();
      }
    };

    const preventContextMenu = (e: Event) => {
      if (isLocked) {
        e.preventDefault();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('keydown', preventDefaultKeys);
    document.addEventListener('copy', preventCopyPaste);
    document.addEventListener('paste', preventCopyPaste);
    document.addEventListener('contextmenu', preventContextMenu);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('keydown', preventDefaultKeys);
      document.removeEventListener('copy', preventCopyPaste);
      document.removeEventListener('paste', preventCopyPaste);
      document.removeEventListener('contextmenu', preventContextMenu);
    };
  }, [isLocked]);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (err) {
      setError('Fullscreen mode is not supported by your browser');
    }
  };

  const toggleTheme = () => {
    setIsDark(!isDark);
  };

  useEffect(() => {
    let resizeTimeout: string | number | NodeJS.Timeout | undefined;
    let resizeAlarmTriggered = false;
  
    const handleVisibilityChange = () => {
      if (document.hidden && isLocked) {
        setTabSwitchCount((count) => count + 1);
        ringAlarm('Tab switch detected!');
      }
    };
  
    const handleBlur = () => {
      if (isLocked && document.visibilityState === 'visible') {
        setWindowSwitchCount((count) => count + 1);
        ringAlarm('Window switch detected!');
      }
    };
  
    const handleFocus = () => {
      if (isLocked) {
        stopAlarm();
        setSecurityWarning(null);
        resizeAlarmTriggered = false; // Reset resize alarm on focus
      }
    };
  
    const handleResize = () => {
      if (isLocked && !resizeAlarmTriggered) {
        ringAlarm('Window resize or split-screen detected!');
        resizeAlarmTriggered = true;
  
        // Wait for resizing to finish
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
          resizeAlarmTriggered = false; // Reset after resizing stops
        }, 2000); // 2-second buffer after resizing stops
      }
    };
  
    const ringAlarm = (message: React.SetStateAction<string | null>) => {
      setSecurityWarning(message);
      if (audioRef.current) {
        audioRef.current.play();
      }
    };
  
    const stopAlarm = () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0; // Reset audio to start
      }
    };
  
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('resize', handleResize);
  
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('resize', handleResize);
    };
  }, [isLocked]);
  

  const startLock = () => {
    setIsLocked(true);
    setRemainingTime(lockDuration * 60); // Convert minutes to seconds
    setSecurityWarning('Tab switching is now locked. An alarm will sound if you try to switch tabs.');
    setTimeout(() => setSecurityWarning(null), 3000);
  };

  const stopLock = () => {
    setIsLocked(false);
    setRemainingTime(0);
    setSecurityWarning('Tab switching lock has been disabled.');
    setTimeout(() => setSecurityWarning(null), 3000);
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };
const downloadImage = (imageUrl: string) => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = 'generated_image.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};
  const generateImage = async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt');
      return;
    }

    setLoading(true);
    setError(null);
    setImage(null);

    try {
      // First pass with base model
      const baseResponse = await fetch('https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_HUGGINGFACE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: {
            negative_prompt: negativePrompt,
            num_inference_steps: options.num_inference_steps,
            guidance_scale: options.guidance_scale,
            width: options.width,
            height: options.height,
          }
        }),
      });

      if (!baseResponse.ok) {
        throw new Error(await handleError(baseResponse));
      }

      const baseBlob = await baseResponse.blob();
      
      // Convert blob to base64 for the refiner
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const base64String = reader.result as string;
          resolve(base64String.split(',')[1]); // Remove data URL prefix
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(baseBlob);
      const base64Data = await base64Promise;

      // Second pass with refiner
      const refinerResponse = await fetch('https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-refiner-1.0', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_HUGGINGFACE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: base64Data,
          parameters: {
            num_inference_steps: options.refiner_steps,
          }
        }),
      });

      if (!refinerResponse.ok) {
        throw new Error(await handleError(refinerResponse));
      }

      const refinedBlob = await refinerResponse.blob();
      const imageUrl = URL.createObjectURL(refinedBlob);
      setImage(imageUrl);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
      console.error('Error generating image:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleError = async (response: Response) => {
    let errorMessage = 'Failed to generate image';
    try {
      const errorData = await response.json();
      errorMessage = errorData.error || 'An error occurred while generating the image';
      
      if (response.status === 401) {
        errorMessage = 'Invalid API key. Please check your Hugging Face API key.';
      } else if (response.status === 503) {
        errorMessage = 'The model is currently loading. Please try again in a few moments.';
      }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      errorMessage = `Server error (${response.status}): Please try again later`;
    }
    return errorMessage;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-gray-900 dark:to-indigo-950 p-8 transition-colors duration-200">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 transition-colors duration-200">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <Sparkles className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">AI Image Generator</h1>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 mr-4">
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={lockDuration}
                  onChange={(e) => setLockDuration(Math.min(60, Math.max(1, parseInt(e.target.value) || 1)))}
                  className="w-16 px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  disabled={isLocked}
                />
                <span className="text-sm text-gray-600 dark:text-gray-400">min</span>
                {isLocked ? (
                  <button
                    onClick={stopLock}
                    className="px-3 py-1 bg-red-600 text-white rounded-lg flex items-center gap-1 text-sm"
                  >
                    <Timer className="w-4 h-4" />
                    {formatTime(remainingTime)}
                  </button>
                ) : (
                  <button
                    onClick={startLock}
                    className="px-3 py-1 bg-green-600 text-white rounded-lg flex items-center gap-1 text-sm"
                  >
                    <Lock className="w-4 h-4" />
                    Lock
                  </button>
                )}
                <div className="mt-4 p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
  <p className="text-gray-700 dark:text-gray-300">Tab switches: {tabSwitchCount}</p>
  <p className="text-gray-700 dark:text-gray-300">Window switches: {windowSwitchCount}</p>
</div>

              </div>
              <button
                onClick={toggleFullscreen}
                className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-200"
                aria-label="Toggle fullscreen"
              >
                <Maximize2 className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-200"
                aria-label="Toggle theme"
              >
                {isDark ? (
                  <Sun className="w-5 h-5 text-yellow-500" />
                ) : (
                  <Moon className="w-5 h-5 text-gray-600" />
                )}
              </button>
            </div>
          </div>

          {securityWarning && (
            <div className="mb-6 bg-yellow-50 dark:bg-yellow-900/50 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 flex items-center gap-3 text-yellow-700 dark:text-yellow-400 transition-colors duration-200">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <p>{securityWarning}</p>
            </div>
          )}

          {!isFullscreen && (
            <div className="mb-6 bg-blue-50 dark:bg-blue-900/50 border border-blue-200 dark:border-blue-800 rounded-lg p-4 flex items-center gap-3 text-blue-700 dark:text-blue-400 transition-colors duration-200">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <p>Please enter full-screen mode for the best experience.</p>
            </div>
          )}

          <div className="space-y-6">
            <div>
              <label htmlFor="prompt" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Prompt
              </label>
              <textarea
                id="prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="A highly detailed digital painting of a magical forest at twilight, with bioluminescent plants and floating orbs of light, 8k resolution, masterpiece, trending on artstation..."
                className="w-full rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:focus:border-indigo-400 dark:focus:ring-indigo-400 p-4 min-h-[100px] transition-colors duration-200"
              />
            </div>

            <div>
              <label htmlFor="negative-prompt" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Negative Prompt
              </label>
              <textarea
                id="negative-prompt"
                value={negativePrompt}
                onChange={(e) => setNegativePrompt(e.target.value)}
                placeholder="What you don't want in the image..."
                className="w-full rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:focus:border-indigo-400 dark:focus:ring-indigo-400 p-4 transition-colors duration-200"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors duration-200"
              >
                <Settings className="w-4 h-4" />
                {showAdvanced ? 'Hide Advanced Settings' : 'Show Advanced Settings'}
              </button>
            </div>

            {showAdvanced && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg transition-colors duration-200">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Base Model Steps ({options.num_inference_steps})
                  </label>
                  <input
                    type="range"
                    min="20"
                    max="150"
                    value={options.num_inference_steps}
                    onChange={(e) => setOptions({ ...options, num_inference_steps: parseInt(e.target.value) })}
                    className="w-full"
                  />
                  <div className="mt-4">
  <p className="text-gray-700 dark:text-gray-300">Tab switches: {tabSwitchCount}</p>
  <p className="text-gray-700 dark:text-gray-300">Window switches: {windowSwitchCount}</p>
</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Refiner Steps ({options.refiner_steps})
                  </label>
                  <input
                    type="range"
                    min="10"
                    max="50"
                    value={options.refiner_steps}
                    onChange={(e) => setOptions({ ...options, refiner_steps: parseInt(e.target.value) })}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Guidance Scale ({options.guidance_scale})
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="20"
                    step="0.5"
                    value={options.guidance_scale}
                    onChange={(e) => setOptions({ ...options, guidance_scale: parseFloat(e.target.value) })}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Width ({options.width}px)
                  </label>
                  <select
                    value={options.width}
                    onChange={(e) => setOptions({ ...options, width: parseInt(e.target.value) })}
                    className="w-full rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:focus:border-indigo-400 dark:focus:ring-indigo-400 transition-colors duration-200"
                  >
                    <option value="512">512px</option>
                    <option value="768">768px</option>
                    <option value="1024">1024px</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Height ({options.height}px)
                  </label>
                  <select
                    value={options.height}
                    onChange={(e) => setOptions({ ...options, height: parseInt(e.target.value) })}
                    className="w-full rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:focus:border-indigo-400 dark:focus:ring-indigo-400 transition-colors duration-200"
                  >
                    <option value="512">512px</option>
                    <option value="768">768px</option>
                    <option value="1024">1024px</option>
                  </select>
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={generateImage}
                disabled={loading || !prompt.trim()}
                className="px-6 py-4 bg-indigo-600 dark:bg-indigo-500 text-white rounded-lg font-medium hover:bg-indigo-700 dark:hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors duration-200"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-5 h-5" />
                    Generate
                  </>
                )}
              </button>
               {image && (
                <button
                  onClick={() => downloadImage(image)}
                  className="px-6 py-4 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 dark:focus:ring-gray-400 flex items-center gap-2 transition-colors duration-200"
                >
                  Download
                </button>
              )}
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center gap-3 text-red-700 dark:text-red-400 transition-colors duration-200">
                <XCircle className="w-5 h-5 flex-shrink-0" />
                <p>{error}</p>
              </div>
            )}

            {image && (
              <div className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 transition-colors duration-200">
                <img
                  src={image}
                  alt={prompt}
                  className="w-full h-auto"
                  style={{ userSelect: 'none' }}
                  onContextMenu={(e) => e.preventDefault()}
                />
              </div>
            )}

            {!image && !error && !loading && (
              <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-12 text-center transition-colors duration-200">
                <ImageIcon className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-600" />
                <p className="mt-4 text-gray-500 dark:text-gray-400">Generated image will appear here</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
