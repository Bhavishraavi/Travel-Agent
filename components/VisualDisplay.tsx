import React from 'react';
import { Itinerary, FlightOffer, FlightSegment } from '../types';
import { PaperAirplaneIcon, GlobeAltIcon, SparklesIcon } from './IconComponents';

interface VisualDisplayProps {
  data: Itinerary | FlightOffer[] | null;
  viewMode: 'itinerary' | 'flights' | 'loading' | 'search';
}

const parseISODuration = (duration: string) => {
    const match = duration.match(/PT(\d+H)?(\d+M)?/);
    if (!match) return duration;
    const hours = match[1] ? parseInt(match[1].slice(0, -1)) : 0;
    const minutes = match[2] ? parseInt(match[2].slice(0, -1)) : 0;
    return `${hours}h ${minutes}m`;
};

const formatTime = (dateTimeString: string) => {
    return new Date(dateTimeString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
};

const formatDate = (dateTimeString: string) => {
    return new Date(dateTimeString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
};

const ItineraryView: React.FC<{ itinerary: Itinerary }> = ({ itinerary }) => (
  <div className="p-6">
    <h2 className="text-2xl font-bold mb-4 text-blue-500 dark:text-blue-400">Your Trip to {itinerary.destination}</h2>
    <div className="space-y-6">
      {itinerary.days.map(day => (
        <div key={day.day} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800/50">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Day {day.day}: {day.title}</h3>
          <ul className="mt-2 list-disc list-inside text-gray-600 dark:text-gray-400 space-y-1">
            {day.activities.map((activity, index) => <li key={index}>{activity}</li>)}
          </ul>
          {day.lodging && <p className="mt-2 text-sm italic text-gray-500">Lodging: {day.lodging}</p>}
        </div>
      ))}
    </div>
  </div>
);

const FlightSegmentView: React.FC<{ segment: FlightSegment }> = ({ segment }) => (
    <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-300">
        <div className="text-center">
            <p className="font-bold text-lg">{segment.departure.iataCode}</p>
            <p>{formatTime(segment.departure.at)}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(segment.departure.at)}</p>
        </div>
        <div className="flex-1 mx-4 text-center">
            <div className="flex items-center justify-center text-gray-400">
                <span className="w-full border-b-2 border-dotted dark:border-gray-600"></span>
                <PaperAirplaneIcon className="w-5 h-5 mx-2 transform -rotate-45" />
                <span className="w-full border-b-2 border-dotted dark:border-gray-600"></span>
            </div>
            <p className="text-xs mt-1">{parseISODuration(segment.duration)}</p>
        </div>
        <div className="text-center">
            <p className="font-bold text-lg">{segment.arrival.iataCode}</p>
            <p>{formatTime(segment.arrival.at)}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(segment.arrival.at)}</p>
        </div>
    </div>
);


const FlightsView: React.FC<{ flights: FlightOffer[] }> = ({ flights }) => (
    <div className="p-6">
        <h2 className="text-2xl font-bold mb-4 text-indigo-500 dark:text-indigo-400">Flight Options</h2>
        <div className="space-y-4">
            {flights.map(flight => (
                <div key={flight.id} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="font-bold text-lg text-gray-800 dark:text-gray-100">{flight.carrierCode || 'Multiple Airlines'}</p>
                            <p className="text-sm text-gray-500">{flight.itineraries[0].segments.length -1 === 0 ? "Nonstop" : `${flight.itineraries[0].segments.length -1} stop(s)`}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-xl font-bold text-green-600 dark:text-green-400">{new Intl.NumberFormat('en-US', { style: 'currency', currency: flight.price.currency }).format(parseFloat(flight.price.total))}</p>
                            <p className="text-xs text-gray-500">Total price</p>
                        </div>
                    </div>
                    <div className="mt-4 space-y-4">
                        {flight.itineraries[0].segments.map((segment, index) => (
                           <FlightSegmentView key={index} segment={segment} />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    </div>
);


const InitialView: React.FC = () => {
    return (
        <div className="flex flex-col items-center justify-center h-full bg-gray-100 dark:bg-gray-800/50 text-center p-8">
            <GlobeAltIcon className="w-24 h-24 text-gray-300 dark:text-gray-600" />
            <h2 className="mt-4 text-2xl font-semibold text-gray-700 dark:text-gray-300">Your Adventure Awaits</h2>
            <p className="mt-2 text-gray-500 dark:text-gray-400">Your visual guide will appear here. Ask me to find flights or plan your itinerary!</p>
        </div>
    );
};


const LoadingView: React.FC = () => (
    <div className="flex flex-col items-center justify-center h-full bg-gray-100 dark:bg-gray-800/50 text-center p-8">
      <SparklesIcon className="w-24 h-24 text-blue-400 animate-pulse" />
      <h2 className="mt-4 text-2xl font-semibold text-gray-700 dark:text-gray-300">Generating Your Experience...</h2>
      <p className="mt-2 text-gray-500 dark:text-gray-400">Our AI is crafting the perfect plan for you.</p>
    </div>
  );

export const VisualDisplay: React.FC<VisualDisplayProps> = ({ data, viewMode }) => {
    const renderContent = () => {
        switch (viewMode) {
          case 'loading':
            return <LoadingView />;
          case 'itinerary':
            return data && 'days' in data ? <ItineraryView itinerary={data} /> : <InitialView />;
          case 'flights':
            return data && Array.isArray(data) ? <FlightsView flights={data} /> : <InitialView />;
          case 'search':
          default:
            return <InitialView />;
        }
      };

  return <div className="h-full overflow-y-auto">{renderContent()}</div>;
};
