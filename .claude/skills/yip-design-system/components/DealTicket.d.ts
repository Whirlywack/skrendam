export interface DealTicketProps {
  /** Destination city, e.g. "Larnaca" */
  place?: string;
  /** Destination country, e.g. "Cyprus" */
  country?: string;
  /** Departure city, e.g. "Vilnius" */
  origin?: string;
  /** Origin IATA code, e.g. "VNO" */
  from?: string;
  /** Destination IATA code, e.g. "LCA" */
  to?: string;
  /** Travel dates, e.g. "14–21 Oct" */
  dates?: string;
  /** Itinerary summary, e.g. "Direct · 4h" */
  legs?: string;
  airline?: string;
  /** Deal price in EUR */
  price?: number;
  /** Usual/median fare in EUR (strikethrough + % under) */
  usual?: number;
  headline?: string;
  /** Mono eyebrow over the photo, e.g. "Last warm week" */
  eyebrow?: string;
  /** CSS background for the photo area (gradient placeholder or image) */
  gradient?: string;
  /** Shows the coral "Going fast" tag */
  hot?: boolean;
  ctaLabel?: string;
  onSee?: () => void;
}
export declare function DealTicket(props: DealTicketProps): JSX.Element;
