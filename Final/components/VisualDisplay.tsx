import React from 'react';
import { Itinerary, FlightOffer, FlightSegment, Hotel, HotelBooking, FlightBooking } from '../types';
import { PaperAirplaneIcon, GlobeAltIcon, SparklesIcon } from './IconComponents';

interface VisualDisplayProps {
  data: Itinerary | FlightOffer[] | Hotel[] | HotelBooking[] | FlightBooking[] | null;
  viewMode: 'itinerary' | 'flights' | 'hotels' | 'hotel-booking' | 'flight-booking' | 'loading' | 'search';
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

const HotelsView: React.FC<{ hotels: Hotel[] }> = ({ hotels }) => (
    <div className="p-6">
        <h2 className="text-2xl font-bold mb-4 text-purple-500 dark:text-purple-400">Hotel Options</h2>
        <div className="space-y-4">
            {hotels.map((hotel, index) => (
                <div key={hotel.place_id || index} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start">
                        <div className="flex-1">
                            <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">{hotel.name}</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{hotel.address}</p>
                            {hotel.rating && (
                                <div className="flex items-center mt-2">
                                    <span className="text-yellow-500 text-lg">★</span>
                                    <span className="ml-1 text-sm font-medium text-gray-700 dark:text-gray-300">{hotel.rating}</span>
                                    {hotel.user_ratings_total && (
                                        <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">({hotel.user_ratings_total} reviews)</span>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    </div>
);

const HotelBookingView: React.FC<{ bookings: HotelBooking[] }> = ({ bookings }) => {
    const booking = bookings[0]; // Display the first booking
    if (!booking) return <InitialView />;
    
    return (
        <div className="p-6">
            <h2 className="text-2xl font-bold mb-4 text-green-500 dark:text-green-400">🎉 Hotel Booking Confirmed!</h2>
            <div className="p-6 border-2 border-green-500 dark:border-green-400 rounded-lg bg-green-50 dark:bg-green-900/20">
                <div className="space-y-3">
                    <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Confirmation Number</p>
                        <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{booking.confirmation_number}</p>
                    </div>
                    <div className="border-t border-gray-300 dark:border-gray-600 pt-3">
                        <p className="text-lg font-semibold text-gray-800 dark:text-gray-100">{booking.hotel_name}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{booking.location}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4 border-t border-gray-300 dark:border-gray-600 pt-3">
                        <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Check-in</p>
                            <p className="font-medium text-gray-800 dark:text-gray-100">{booking.check_in_date}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Check-out</p>
                            <p className="font-medium text-gray-800 dark:text-gray-100">{booking.check_out_date}</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Guests</p>
                            <p className="font-medium text-gray-800 dark:text-gray-100">{booking.num_guests}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Room Type</p>
                            <p className="font-medium text-gray-800 dark:text-gray-100">{booking.room_type}</p>
                        </div>
                    </div>
                    <div className="border-t border-gray-300 dark:border-gray-600 pt-3">
                        <p className="text-xs text-gray-500 dark:text-gray-400">Total Price</p>
                        <p className="text-2xl font-bold text-green-600 dark:text-green-400">${booking.total_price.toFixed(2)}</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

const FlightBookingView: React.FC<{ bookings: FlightBooking[] }> = ({ bookings }) => {
    const booking = bookings[0]; // Display the first booking
    if (!booking) return <InitialView />;
    
    return (
        <div className="p-6">
            <h2 className="text-2xl font-bold mb-4 text-blue-500 dark:text-blue-400">🎉 Flight Booking Confirmed!</h2>
            <div className="p-6 border-2 border-blue-500 dark:border-blue-400 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                <div className="space-y-3">
                    <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Confirmation Number</p>
                        <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{booking.confirmation_number}</p>
                    </div>
                    <div className="border-t border-gray-300 dark:border-gray-600 pt-3">
                        <p className="text-lg font-semibold text-gray-800 dark:text-gray-100">{booking.airline} {booking.flight_number}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{booking.origin} → {booking.destination}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4 border-t border-gray-300 dark:border-gray-600 pt-3">
                        <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Departure</p>
                            <p className="font-medium text-gray-800 dark:text-gray-100">{booking.departure_date}</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">{booking.departure_time}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Arrival</p>
                            <p className="font-medium text-gray-800 dark:text-gray-100">{booking.departure_date}</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">{booking.arrival_time}</p>
                        </div>
                    </div>
                    {booking.return_date && (
                        <div className="grid grid-cols-2 gap-4 border-t border-gray-300 dark:border-gray-600 pt-3">
                            <div>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Return Date</p>
                                <p className="font-medium text-gray-800 dark:text-gray-100">{booking.return_date}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Return Flight</p>
                                <p className="font-medium text-gray-800 dark:text-gray-100">{booking.return_flight_number}</p>
                            </div>
                        </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Passengers</p>
                            <p className="font-medium text-gray-800 dark:text-gray-100">{booking.num_passengers}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Class</p>
                            <p className="font-medium text-gray-800 dark:text-gray-100">{booking.travel_class}</p>
                        </div>
                    </div>
                    <div className="border-t border-gray-300 dark:border-gray-600 pt-3">
                        <p className="text-xs text-gray-500 dark:text-gray-400">Total Price</p>
                        <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{booking.currency_code} {booking.price.toFixed(2)}</p>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 italic">
                        Trip Type: {booking.trip_type}
                    </div>
                </div>
            </div>
        </div>
    );
};

export const VisualDisplay: React.FC<VisualDisplayProps> = ({ data, viewMode }) => {
    const renderContent = () => {
        switch (viewMode) {
          case 'loading':
            return <LoadingView />;
          case 'itinerary':
            return data && 'days' in data ? <ItineraryView itinerary={data} /> : <InitialView />;
          case 'flights':
            return data && Array.isArray(data) && data.length > 0 && 'itineraries' in data[0] ? <FlightsView flights={data as FlightOffer[]} /> : <InitialView />;
          case 'hotels':
            return data && Array.isArray(data) && data.length > 0 && 'place_id' in data[0] ? <HotelsView hotels={data as Hotel[]} /> : <InitialView />;
          case 'hotel-booking':
            return data && Array.isArray(data) && data.length > 0 && 'confirmation_number' in data[0] && 'hotel_name' in data[0] ? <HotelBookingView bookings={data as HotelBooking[]} /> : <InitialView />;
          case 'flight-booking':
            return data && Array.isArray(data) && data.length > 0 && 'confirmation_number' in data[0] && 'airline' in data[0] ? <FlightBookingView bookings={data as FlightBooking[]} /> : <InitialView />;
          case 'search':
          default:
            return <InitialView />;
        }
      };

  return <div className="h-full overflow-y-auto">{renderContent()}</div>;
};
