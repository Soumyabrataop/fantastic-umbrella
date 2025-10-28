"use client";

interface AdCardProps {
  position?: number;
}

export default function AdCard({ position = 0 }: AdCardProps) {
  return (
    <div className="bg-linear-to-br from-purple-100 to-blue-100 rounded-lg shadow-md overflow-hidden mb-4 max-w-md mx-auto">
      <div className="p-6 text-center">
        <div className="text-xs text-gray-500 mb-3">Sponsored</div>

        <div className="mb-4">
          <div className="w-16 h-16 bg-linear-to-br from-purple-500 to-blue-500 rounded-full mx-auto mb-3 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          </div>

          <h3 className="text-lg font-bold text-gray-900 mb-2">
            Boost Your Video
          </h3>

          <p className="text-sm text-gray-600 mb-4">
            Get more views and engagement with our premium promotion service
          </p>
        </div>

        <button className="bg-linear-to-r from-purple-600 to-blue-600 text-white px-6 py-2 rounded-full font-medium hover:shadow-lg transition-shadow">
          Learn More
        </button>
      </div>

      {/* Ad Variations */}
      {position % 3 === 1 && (
        <div className="bg-linear-to-br from-green-100 to-teal-100 p-6 text-center">
          <div className="text-xs text-gray-500 mb-3">Sponsored</div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">
            🎨 Premium AI Tools
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Unlock advanced features and create stunning videos
          </p>
          <button className="bg-linear-to-r from-green-600 to-teal-600 text-white px-6 py-2 rounded-full font-medium hover:shadow-lg transition-shadow">
            Upgrade Now
          </button>
        </div>
      )}

      {position % 3 === 2 && (
        <div className="bg-linear-to-br from-orange-100 to-red-100 p-6 text-center">
          <div className="text-xs text-gray-500 mb-3">Sponsored</div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">
            ⚡ Faster Generation
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Skip the queue and generate videos instantly
          </p>
          <button className="bg-linear-to-r from-orange-600 to-red-600 text-white px-6 py-2 rounded-full font-medium hover:shadow-lg transition-shadow">
            Go Premium
          </button>
        </div>
      )}
    </div>
  );
}
