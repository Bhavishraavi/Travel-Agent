// Fix: Import React to provide types for JSX intrinsic elements.
import type * as React from 'react';

export interface Transcript {
  speaker: 'user' | 'ai';
  text: string;
  isFinal?: boolean;
}

export interface ItineraryDay {
  day: number;
  title: string;
  activities: string[];
  lodging?: string;
}

export interface Itinerary {
  destination: string;
  duration: number;
  days: ItineraryDay[];
}

export interface FlightPrice {
    currency: string;
    total: string;
}

export interface FlightSegment {
    departure: {
        iataCode: string;
        at: string; 
    };
    arrival: {
        iataCode: string;
        at: string; 
    };
    carrierCode: string;
    duration: string; 
    numberOfStops: number;
}

export interface FlightItinerary {
    duration: string;
    segments: FlightSegment[];
}

export interface FlightOffer {
    id: string;
    price: FlightPrice;
    itineraries: FlightItinerary[];
    carrierCode?: string; 
}


// Fix: Add LiveSession interface because it is not exported from the SDK.
export interface LiveSession {
  close: () => void;
  sendToolResponse: (response: { functionResponses: any[] }) => void;
  sendRealtimeInput: (input: { media: any }) => void;
}

// Allow TypeScript to recognize Google Maps web components
declare global {
    // Fix: Add window.google definition for Google Maps API
    interface Window {
      google: any;
    }
    namespace JSX {
      // Fix: Use more specific types for Google Maps web components to allow standard HTML attributes and refs.
      // FIX: Added missing attributes for Google Maps web components to resolve TypeScript errors.
      interface IntrinsicElements {
        'gmp-map': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
            class?: string;
            center?: string;
            zoom?: string;
            'map-id'?: string;
        }, HTMLElement>;
        'gmpx-api-loader': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
            class?: string;
            'solution-channel'?: string;
        }, HTMLElement>;
        'gmpx-place-picker': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
            class?: string;
            placeholder?: string;
        }, HTMLElement>;
        'gmp-advanced-marker': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
            class?: string;
        }, HTMLElement>;
      }
    }
}
