import type { Category } from '../domain/vehicle.js';

/**
 * DEMO DATA. Makes and models are real product names so the catalogue looks familiar, but the
 * prices and stock are invented for this exercise. They are not offers and not market prices.
 * Prices are whole rupees here and become paise (minor units) when stored.
 */
export type DemoVehicle = {
  make: string;
  model: string;
  category: Category;
  priceRupees: number;
  quantity: number;
  year: number;
  colorOptions: string[];
  note: string;
};

export const DEMO_VEHICLES: readonly DemoVehicle[] = [
  // HATCHBACK
  {
    make: 'Maruti Suzuki',
    model: 'Swift',
    category: 'HATCHBACK',
    priceRupees: 650_000,
    quantity: 8,
    year: 2025,
    colorOptions: ['#C0392B', '#1F5FBF', '#F2F2F2'],
    note: 'Compact city hatchback.',
  },
  {
    make: 'Hyundai',
    model: 'i20',
    category: 'HATCHBACK',
    priceRupees: 780_000,
    quantity: 5,
    year: 2025,
    colorOptions: ['#1B1B1B', '#B42318', '#8FA3B3'],
    note: 'Premium hatchback with a roomy cabin.',
  },
  {
    make: 'Tata',
    model: 'Altroz',
    category: 'HATCHBACK',
    priceRupees: 710_000,
    quantity: 2,
    year: 2024,
    colorOptions: ['#E6B422', '#F2F2F2', '#2F4F4F'],
    note: 'Wide-stance hatchback.',
  },

  // SEDAN
  {
    make: 'Honda',
    model: 'City',
    category: 'SEDAN',
    priceRupees: 1_250_000,
    quantity: 6,
    year: 2025,
    colorOptions: ['#F2F2F2', '#1B1B1B', '#7A8B99'],
    note: 'Mid-size sedan for daily commutes.',
  },
  {
    make: 'Skoda',
    model: 'Slavia',
    category: 'SEDAN',
    priceRupees: 1_160_000,
    quantity: 3,
    year: 2025,
    colorOptions: ['#2E7D32', '#F2F2F2', '#1B1B1B'],
    note: 'Spacious sedan with a large boot.',
  },
  {
    make: 'Volkswagen',
    model: 'Virtus',
    category: 'SEDAN',
    priceRupees: 1_180_000,
    quantity: 0,
    year: 2024,
    colorOptions: ['#B0B7BD', '#1F3A5F', '#F2F2F2'],
    note: 'Sold out in this demo, to show the sold-out state.',
  },

  // SUV
  {
    make: 'Hyundai',
    model: 'Creta',
    category: 'SUV',
    priceRupees: 1_350_000,
    quantity: 7,
    year: 2025,
    colorOptions: ['#1B1B1B', '#F2F2F2', '#8B5A2B'],
    note: 'Family SUV with a high seating position.',
  },
  {
    make: 'Mahindra',
    model: 'XUV700',
    category: 'SUV',
    priceRupees: 1_520_000,
    quantity: 4,
    year: 2025,
    colorOptions: ['#2F4F4F', '#B42318', '#F2F2F2'],
    note: 'Three-row SUV.',
  },
  {
    make: 'Kia',
    model: 'Seltos',
    category: 'SUV',
    priceRupees: 1_280_000,
    quantity: 1,
    year: 2025,
    colorOptions: ['#6B7B8C', '#1B1B1B', '#C9A227'],
    note: 'Last unit in this demo, to show low stock.',
  },

  // COUPE
  {
    make: 'BMW',
    model: '2 Series Gran Coupe',
    category: 'COUPE',
    priceRupees: 4_390_000,
    quantity: 2,
    year: 2025,
    colorOptions: ['#1F5FBF', '#1B1B1B', '#F2F2F2'],
    note: 'Four-door coupe.',
  },
  {
    make: 'Mercedes-Benz',
    model: 'CLA',
    category: 'COUPE',
    priceRupees: 5_000_000,
    quantity: 1,
    year: 2025,
    colorOptions: ['#B0B7BD', '#1B1B1B', '#7A1F2B'],
    note: 'Sloping roofline coupe.',
  },
  {
    make: 'Audi',
    model: 'A5',
    category: 'COUPE',
    priceRupees: 5_500_000,
    quantity: 2,
    year: 2024,
    colorOptions: ['#2F2F2F', '#F2F2F2', '#B42318'],
    note: 'Grand tourer coupe.',
  },

  // CONVERTIBLE
  {
    make: 'Mini',
    model: 'Cooper Convertible',
    category: 'CONVERTIBLE',
    priceRupees: 5_700_000,
    quantity: 1,
    year: 2024,
    colorOptions: ['#E6B422', '#C0392B', '#1B1B1B'],
    note: 'Soft-top for sunny weekends.',
  },
  {
    make: 'BMW',
    model: 'Z4',
    category: 'CONVERTIBLE',
    priceRupees: 9_200_000,
    quantity: 1,
    year: 2025,
    colorOptions: ['#B42318', '#1B1B1B', '#B0B7BD'],
    note: 'Two-seat roadster.',
  },
  {
    make: 'Porsche',
    model: '718 Boxster',
    category: 'CONVERTIBLE',
    priceRupees: 15_000_000,
    quantity: 0,
    year: 2024,
    colorOptions: ['#E6B422', '#1B1B1B', '#F2F2F2'],
    note: 'Sold out in this demo, to show the sold-out state.',
  },

  // TRUCK
  {
    make: 'Toyota',
    model: 'Hilux',
    category: 'TRUCK',
    priceRupees: 3_000_000,
    quantity: 3,
    year: 2025,
    colorOptions: ['#F2F2F2', '#1B1B1B', '#6B7B8C'],
    note: 'Double-cab pickup.',
  },
  {
    make: 'Isuzu',
    model: 'D-Max V-Cross',
    category: 'TRUCK',
    priceRupees: 2_700_000,
    quantity: 4,
    year: 2025,
    colorOptions: ['#8B5A2B', '#F2F2F2', '#1B1B1B'],
    note: 'Lifestyle pickup.',
  },
  {
    make: 'Mahindra',
    model: 'Bolero Pik-Up',
    category: 'TRUCK',
    priceRupees: 1_000_000,
    quantity: 9,
    year: 2024,
    colorOptions: ['#F2F2F2', '#2E7D32', '#1F5FBF'],
    note: 'Light commercial pickup.',
  },

  // EV
  {
    make: 'Tata',
    model: 'Nexon EV',
    category: 'EV',
    priceRupees: 1_500_000,
    quantity: 5,
    year: 2025,
    colorOptions: ['#2E7D32', '#F2F2F2', '#1F3A5F'],
    note: 'Compact electric SUV.',
  },
  {
    make: 'MG',
    model: 'ZS EV',
    category: 'EV',
    priceRupees: 1_850_000,
    quantity: 3,
    year: 2025,
    colorOptions: ['#B0B7BD', '#1B1B1B', '#C0392B'],
    note: 'Electric crossover.',
  },
  {
    make: 'BYD',
    model: 'Atto 3',
    category: 'EV',
    priceRupees: 2_500_000,
    quantity: 0,
    year: 2024,
    colorOptions: ['#1F5FBF', '#F2F2F2', '#1B1B1B'],
    note: 'Sold out in this demo, to show the sold-out state.',
  },

  // SPORTS
  {
    make: 'Porsche',
    model: '911 Carrera',
    category: 'SPORTS',
    priceRupees: 19_900_000,
    quantity: 1,
    year: 2025,
    colorOptions: ['#C0392B', '#1B1B1B', '#B0B7BD'],
    note: 'Rear-engined sports car.',
  },
  {
    make: 'Lotus',
    model: 'Emira',
    category: 'SPORTS',
    priceRupees: 30_000_000,
    quantity: 1,
    year: 2025,
    colorOptions: ['#E6B422', '#2E7D32', '#F2F2F2'],
    note: 'Mid-engined sports car.',
  },
  {
    make: 'Toyota',
    model: 'GR Supra',
    category: 'SPORTS',
    priceRupees: 9_900_000,
    quantity: 2,
    year: 2024,
    colorOptions: ['#F2F2F2', '#B42318', '#1B1B1B'],
    note: 'Front-engined sports coupe.',
  },
];
