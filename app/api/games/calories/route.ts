import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const CATEGORIES = [
  'snack',
  'beverage',
  'cheese',
  'dessert',
  'pizza',
  'sandwich',
  'breakfast',
  'burger',
  'cake',
  'chocolate',
  'fruit',
  'vegetable'
];

async function getProducts(count: number): Promise<any[]> {
  try {
    // Search random category or generic high level terms
    const term = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
    // Using search.pl for better results than V2 sometimes
    // Fetch more than needed to filter
    const pageSize = Math.max(20, count * 2); 
    const page = Math.floor(Math.random() * 10) + 1;
    
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${term}&search_simple=1&action=process&json=1&page_size=${pageSize}&page=${page}&fields=product_name,image_front_url,nutriments,quantity`;
    
    const response = await fetch(url);
    if (!response.ok) throw new Error('OFF API Error');
    
    const data = await response.json();
    
    if (!data.products) return [];

    // Filter valid products
    const validProducts = data.products.filter(
      (p: any) => 
        p.product_name && 
        p.product_name.length < 50 && // Avoid super long weird names
        p.image_front_url && 
        (p.nutriments['energy-kcal_100g'] || p.nutriments['energy-kcal'])
    ).map((p: any) => {
        let cals = p.nutriments['energy-kcal_100g'] || p.nutriments['energy-kcal'];
        return {
            category: term,
            image: p.image_front_url,
            profile: {
                label: p.product_name,
                min: 0,
                max: 1000,
                exact: Math.round(cals),
                portion: '100g'
            }
        };
    });
    
    // Shuffle
    for (let i = validProducts.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [validProducts[i], validProducts[j]] = [validProducts[j], validProducts[i]];
    }
    
    return validProducts.slice(0, count);

  } catch (error) {
    console.error('Erreur API Open Food Facts:', error);
    return [];
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const count = parseInt(searchParams.get('count') || '1', 10);
    
    const products = await getProducts(count);
    
    if (products.length === 0) {
        // Fallback to a hardcoded safe product if API fails entirely
        return NextResponse.json([{
            category: 'fallback',
            image: 'https://images.openfoodfacts.org/images/products/302/933/000/3533/front_en.3.400.jpg',
            profile: {
                label: 'Big Mac (Fallback)',
                min: 0,
                max: 1000,
                exact: 257,
                portion: '100g'
            }
        }]);
    }
    
    return NextResponse.json(products);
    
  } catch (error) {
    console.error('Erreur API CaloriesGuessr:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la génération du jeu' },
      { status: 500 }
    );
  }
}
