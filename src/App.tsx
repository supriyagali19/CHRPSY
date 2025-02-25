import React, { useState, useEffect } from 'react';
import { ImageIcon, Loader2, Sparkles, XCircle, Settings, Sun, Moon, Wand2 } from 'lucide-react';

interface GenerationOptions {
  negative_prompt?: string;
  num_inference_steps?: number;
  guidance_scale?: number;
  width?: number;
  height?: number;
  refiner_steps?: number;
}

function App() {
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('blurry, bad quality, distorted, deformed, ugly, bad anatomy');
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' ||
        (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });

  const [options, setOptions] = useState<GenerationOptions>({
    num_inference_steps: 50,
    guidance_scale: 7.5,
    width: 1024,
    height: 1024,
    refiner_steps: 20,
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  const toggleTheme = () => {
    setIsDark(!isDark);
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
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">CHRPSY</h1>
            </div>
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