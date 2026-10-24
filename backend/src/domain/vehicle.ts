export const CATEGORIES = [
  'HATCHBACK',
  'SEDAN',
  'SUV',
  'COUPE',
  'CONVERTIBLE',
  'TRUCK',
  'EV',
  'SPORTS',
] as const;

export type Category = (typeof CATEGORIES)[number];

/** Which illustration template draws the car. Same set as categories; it defaults from the category. */
export type BodyStyle = Category;

/** A vehicle as the API exposes it. `price` is an integer in minor units (paise). */
export type Vehicle = {
  id: string;
  make: string;
  model: string;
  category: Category;
  price: number;
  quantity: number;
  year: number | null;
  bodyStyle: BodyStyle;
  colorOptions: string[];
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
};
