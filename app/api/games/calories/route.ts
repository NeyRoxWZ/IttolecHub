import { NextRequest, NextResponse } from 'next/server';

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

async function getProduct(): Promise<any> {
  try {
    // Search random category or generic high level terms
    const term = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
    // Using search.pl for better results than V2 sometimes
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${term}&search_simple=1&action=process&json=1&page_size=50&fields=product_name,image_url,nutriments,quantity`;
    
    const response = await fetch(url);
    if (!response.ok) throw new Error('OFF API Error');
    
    const data = await response.json();
    
    if (!data.products) return null;

    // Filter valid products
    const validProducts = data.products.filter(
      (p: any) => 
        p.product_name && 
        p.product_name.length < 50 && // Avoid super long weird names
        p.image_url && 
        (p.nutriments['energy-kcal_100g'] || p.nutriments['energy-kcal'])
    );
    
    if (validProducts.length === 0) return null;
    
    return validProducts[Math.floor(Math.random() * validProducts.length)];

  } catch (error) {
    console.error('Erreur API Open Food Facts:', error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const product = await getProduct();
    
    if (!product) {
        // Fallback to a hardcoded safe product if API fails entirely
        return NextResponse.json({
            name: 'Big Mac',
            imageUrl: 'https://images.openfoodfacts.org/images/products/302/933/000/3533/front_en.3.400.jpg',
            calories: 257, // per 100g usually
            portion: '100g'
        });
    }
    
    let cals = product.nutriments['energy-kcal_100g'] || product.nutriments['energy-kcal'];
    
    return NextResponse.json({
      name: product.product_name,
      imageUrl: product.image_url,
      calories: Math.round(cals),
      portion: '100g' // OFF standardizes on 100g usually, hard to parse quantity reliably without complex logic
    });
    
  } catch (error) {
    console.error('Erreur API CaloriesGuessr:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la génération du jeu' },
      { status: 500 }
    );
  }
}