import type { Video } from "@/types";

// Sample video URLs from public sources with fallbacks
// Using more reliable CDN sources
const sampleVideoUrls = [
  "https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
  "https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
  "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
  "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
  "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
  "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
  "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4",
  "https://storage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4",
  "https://storage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4",
  "https://storage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
];

// Fallback video URLs if primary sources fail
const fallbackVideoUrls = [
  "https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4",
  "https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_2MB.mp4",
  "https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_5MB.mp4",
];

// Sample usernames
const sampleUsernames = [
  "AICreator",
  "VideoMaster",
  "DigitalArtist",
  "TechWizard",
  "CreativeGenius",
  "PixelPro",
  "VisionaryMaker",
  "ContentKing",
  "StudioExpert",
  "MediaNinja",
  "ArtisticSoul",
  "InnovatorX",
  "DreamWeaver",
  "VisualVirtuoso",
  "NextGenArtist",
];

// Sample prompts
const samplePrompts = [
  "A futuristic city at sunset with flying cars and neon lights",
  "An astronaut floating in space with Earth in the background",
  "A dragon breathing fire over a medieval castle",
  "Ocean waves crashing on a beach during golden hour",
  "A robot dancing in Times Square with vibrant energy",
  "Northern lights over a snowy mountain landscape",
  "Underwater coral reef with colorful fish swimming",
  "Time-lapse of clouds moving over a cityscape",
  "Cherry blossoms falling in a Japanese garden",
  "Lightning storm over a desert at night",
  "Sunset over African savanna with silhouettes of animals",
  "Rainforest canopy with exotic birds flying",
  "Ancient temple ruins covered in vines and moss",
  "Steampunk airship flying through cloudy skies",
  "Cyberpunk street market with holographic displays",
  "Magical forest with glowing mushrooms and fireflies",
  "Abstract geometric shapes morphing and rotating",
  "Vintage car driving on coastal highway",
  "Space station orbiting a distant planet",
  "Waterfall cascading into a crystal clear pool",
];

// Generate random number within range
const randomInt = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

// Generate a single mock video
const generateMockVideo = (index: number): Video => {
  const videoUrl = sampleVideoUrls[index % sampleVideoUrls.length];
  const username = sampleUsernames[randomInt(0, sampleUsernames.length - 1)];
  const prompt = samplePrompts[randomInt(0, samplePrompts.length - 1)];
  const likes = randomInt(10, 5000);
  const dislikes = randomInt(0, 500);
  const views = randomInt(likes, likes * 10);

  return {
    id: `mock-video-${index + 1}`,
    userId: `user-${randomInt(1, 100)}`,
    username,
    prompt,
    videoUrl,
    thumbnailUrl: "", // Thumbnails will be generated from video
    likes,
    dislikes,
    views,
    createdAt: new Date(
      Date.now() - randomInt(0, 30) * 24 * 60 * 60 * 1000
    ).toISOString(),
    status: "completed" as const,
  };
};

// Generate multiple mock videos
export const generateMockVideos = (count: number = 20): Video[] => {
  return Array.from({ length: count }, (_, index) => generateMockVideo(index));
};

// Export a single mock video for testing
export const getMockVideo = (): Video => generateMockVideo(0);
