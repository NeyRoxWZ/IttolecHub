import { NextRequest, NextResponse } from 'next/server';

const CATEGORIES = [
  'snacks',
  'beverages',
  'cheeses',
  'desserts',
  'pizzas',
  'sandwiches',
  'breakfasts',
];

async function getProduct(category: string, country: string = 'world'): Promise<any> {
  try {
    const url = `https://${country}.openfoodfacts.org/api/v2/search?categories_tags_en=${category}&fields=product_name,image_url,nutriments&page_size=50`;
    const response = await fetch(url);
    const data = await response.json();
    
    // Filtrer les produits qui ont un nom, une image et des calories
    const validProducts = data.products.filter(
      (p: any) => p.product_name && p.image_url && p.nutriments['energy-kcal_100g']
    );
    
    if (validProducts.length === 0) {
      return null;
    }
    
    // Choisir un produit aléatoire
    return validProducts[Math.floor(Math.random() * validProducts.length)];

  } catch (error) {
    console.error('Erreur API Open Food Facts:', error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
    const country = searchParams.get('country') || 'world';
    
    const product = await getProduct(category, country);
    
    if (!product) {
      return NextResponse.json(
        { error: 'Aucun produit trouvé pour cette catégorie' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      name: product.product_name,
      imageUrl: product.image_url,
      calories: Math.round(product.nutriments['energy-kcal_100g']),
    });
    
  } catch (error) {
    console.error('Erreur API CaloriesGuessr:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la génération du jeu' },
      { status: 500 }
    );
  }
}